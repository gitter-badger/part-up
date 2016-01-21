Meteor.methods({

    /**
     * Insert a Network
     *
     * @param {mixed[]} fields
     */
    'networks.insert': function(fields) {
        check(fields, Partup.schemas.forms.networkCreate);

        var user = Meteor.user();
        if (!user || !User(user).isAdmin()) {
            throw new Meteor.Error(401, 'unauthorized');
        }

        try {
            var network = {};
            network.name = fields.name;
            network.privacy_type = fields.privacy_type;
            network.slug = Partup.server.services.slugify.slugify(fields.name);
            network.uppers = [user._id];
            network.admin_id = user._id;
            network.created_at = new Date();
            network.updated_at = new Date();

            network._id = Networks.insert(network);
            Meteor.users.update(user._id, {$addToSet: {networks: network._id}});

            return {
                _id: network._id
            };
        } catch (error) {
            Log.error(error);
            throw new Meteor.Error(400, 'network_could_not_be_inserted');
        }
    },

    /**
     * Update a Network
     *
     * @param {String} networkId
     * @param {mixed[]} fields
     */
    'networks.update': function(networkId, fields) {
        check(networkId, String);
        check(fields, Partup.schemas.forms.network);

        var user = Meteor.user();
        var network = Networks.findOneOrFail(networkId);

        if (!user || !network.isAdmin(user._id)) {
            throw new Meteor.Error(401, 'unauthorized');
        }

        try {
            var newNetworkFields = Partup.transformers.network.fromFormNetwork(fields);

            Networks.update(networkId, {$set: newNetworkFields});

            return {
                _id: network._id
            };
        } catch (error) {
            Log.error(error);
            throw new Meteor.Error(400, 'network_could_not_be_updated');
        }
    },

    /**
     * Invite someone to a network
     *
     * @param {String} networkId
     * @param {Object} fields
     * @param {String} fields.name
     * @param {String} fields.email
     * @param {String} fields.message
     */
    'networks.invite_by_email': function(networkId, fields) {
        check(fields, Partup.schemas.forms.inviteUpper);

        var inviter = Meteor.user();

        if (!inviter) {
            throw new Meteor.Error(401, 'unauthorized');
        }

        var network = Networks.findOneOrFail(networkId);

        if (!network.hasMember(inviter._id)) {
            throw new Meteor.Error(401, 'unauthorized');
        }

        var isAlreadyInvited = !!Invites.findOne({
            network_id: networkId,
            invitee_email: fields.email,
            type: Invites.INVITE_TYPE_NETWORK_EMAIL
        });

        if (isAlreadyInvited) {
            throw new Meteor.Error(403, 'email_is_already_invited_to_network');
        }

        var accessToken = Random.secret();

        var invite = {
            type: Invites.INVITE_TYPE_NETWORK_EMAIL,
            network_id: network._id,
            inviter_id: inviter._id,
            invitee_name: fields.name,
            invitee_email: fields.email,
            message: fields.message,
            access_token: accessToken,
            created_at: new Date
        };

        Invites.insert(invite);

        // Save the access token to the network to allow access
        Networks.update(network._id, {$addToSet: {access_tokens: accessToken}});

        Event.emit('invites.inserted.network.by_email', inviter, network, fields.email, fields.name, fields.message, accessToken);
    },

    /**
     * Invite multple uppers to a network
     *
     * @param {String} networkId
     * @param {Object} fields
     * @param {String} fields.csv
     * @param {String} fields.message
     * @param {Object[]} invitees
     */
    'networks.invite_by_email_bulk': function(networkId, fields, invitees) {
        check(fields, Partup.schemas.forms.networkBulkinvite);

        if (!invitees || (invitees.length < 1 || invitees.length > 200)) {
            throw new Meteor.Error(400, 'invalid_invitees');
        }

        var inviter = Meteor.user();

        if (!inviter) {
            throw new Meteor.Error(401, 'unauthorized');
        }

        var network = Networks.findOneOrFail(networkId);

        if (!network.hasMember(inviter._id)) {
            throw new Meteor.Error(401, 'unauthorized');
        }

        // Create invites array
        var invites = invitees.map(function(invitee) {
            var isAlreadyInvited = !!Invites.findOne({
                network_id: network._id,
                invitee_email: invitee.email,
                type: Invites.INVITE_TYPE_NETWORK_EMAIL
            });

            if (isAlreadyInvited) return false;

            var accessToken = Random.secret();

            Networks.update(network._id, {$addToSet: {access_tokens: accessToken}});

            Event.emit('invites.inserted.network.by_email', inviter, network, invitee.email, invitee.name, fields.message, accessToken);

            return {
                type: Invites.INVITE_TYPE_NETWORK_EMAIL,
                network_id: network._id,
                inviter_id: inviter._id,
                invitee_name: invitee.name,
                invitee_email: invitee.email,
                message: fields.message,
                access_token: accessToken,
                created_at: new Date
            };
        });

        // Remove falsy values
        invites = lodash.compact(invites);

        // Insert all invites
        invites.forEach(function(invite) {
            Invites.insert(invite);
        });

        // Return the total count of successful invites
        return invites.length;
    },

    /**
     * Invite an existing upper to an network
     *
     * @param {String} networkId
     * @param {String} inviteeId
     */
    'networks.invite_existing_upper': function(networkId, inviteeId) {
        check(networkId, String);
        check(inviteeId, String);

        var inviter = Meteor.user();
        var network = Networks.findOneOrFail(networkId);

        if (!inviter || !network.hasMember(inviter._id)) {
            throw new Meteor.Error(401, 'unauthorized');
        }

        if (network.hasMember(inviteeId)) {
            throw new Meteor.Error(409, 'user_is_already_member_of_network');
        }

        var invitee = Meteor.users.findOneOrFail(inviteeId);
        var isAlreadyInvited = !!Invites.findOne({network_id: networkId, invitee_id: invitee._id, inviter_id: inviter._id, type: Invites.INVITE_TYPE_NETWORK_EXISTING_UPPER});
        if (isAlreadyInvited) {
            throw new Meteor.Error(403, 'user_is_already_invited_to_network');
        }

        // Store invite
        var invite = {
            type: Invites.INVITE_TYPE_NETWORK_EXISTING_UPPER,
            network_id: network._id,
            inviter_id: inviter._id,
            invitee_id: invitee._id,
            created_at: new Date
        };

        Invites.insert(invite);

        Event.emit('invites.inserted.network', inviter, network, invitee);
    },

    /**
     * Join a Network
     *
     * @param {String} networkId
     */
    'networks.join': function(networkId) {
        check(networkId, String);

        var user = Meteor.user();
        var network = Networks.findOneOrFail(networkId);

        if (!user) {
            throw new Meteor.Error(401, 'unauthorized');
        }

        if (network.hasMember(user._id)) {
            throw new Meteor.Error(409, 'user_is_already_member_of_network');
        }

        try {
            if (network.isClosed()) {
                // Instantly add user when invited by an admin
                if (network.isUpperInvitedByAdmin(user._id)) {
                    network.addUpper(user._id);
                    Event.emit('networks.uppers.inserted', user, network);
                    return Log.debug('User added to closed network due to admin invite.');
                }

                // Add user to pending if it's a closed network
                network.addPendingUpper(user._id);

                // Send notification to admin
                Event.emit('networks.new_pending_upper', network, user);
                return Log.debug('User (already) added to waiting list');
            }

            if (network.isInvitational()) {
                // Check if the user is invited
                if (network.isUpperInvited(user._id)) {
                    network.addUpper(user._id);
                    Event.emit('networks.uppers.inserted', user, network);
                    return Log.debug('User added to invitational network.');
                } else {
                    if (network.addPendingUpper(user._id)) {
                        return Log.debug('This network is for invited members only. Added user to pending list.');
                    } else {
                        return Log.debug('User is already added to pending list.');
                    }
                }
            }

            if (network.isPublic()) {
                // Allow user instantly
                network.addUpper(user._id);
                Event.emit('networks.uppers.inserted', user, network);
                return Log.debug('User added to public network.');
            }

            return Log.debug('Unknown access level for this network: ' + network.privacy_type);
        } catch (error) {
            Log.error(error);
            throw new Meteor.Error(400, 'user_could_not_join_network');
        }
    },

    /**
     * Accept a request to join network
     *
     * @param {String} networkId
     * @param {String} upperId
     */
    'networks.accept': function(networkId, upperId) {
        check(networkId, String);
        check(upperId, String);

        var user = Meteor.user();
        var network = Networks.findOneOrFail(networkId);

        if (!network.isNetworkAdmin(user._id)) {
            throw new Meteor.Error(401, 'unauthorized');
        }

        if (network.hasMember(upperId)) {
            throw new Meteor.Error(409, 'user_is_already_member_of_network');
        }

        try {
            network.acceptPendingUpper(upperId);
            network.removeAllUpperInvites(upperId);

            Event.emit('networks.accepted', user._id, networkId, upperId);

            return {
                network_id: network._id,
                upper_id: upperId
            };
        } catch (error) {
            Log.error(error);
            throw new Meteor.Error(400, 'user_could_not_be_accepted_from_network');
        }
    },

    /**
     * Reject a request to join network
     *
     * @param {String} networkId
     * @param {String} upperId
     */
    'networks.reject': function(networkId, upperId) {
        check(networkId, String);
        check(upperId, String);

        var user = Meteor.user();
        var network = Networks.findOneOrFail(networkId);

        if (!network.isNetworkAdmin(user._id)) {
            throw new Meteor.Error(401, 'unauthorized');
        }

        try {
            network.rejectPendingUpper(upperId);

            return {
                network_id: network._id,
                upper_id: upperId
            };
        } catch (error) {
            Log.error(error);
            throw new Meteor.Error(400, 'user_could_not_be_rejected_from_network');
        }
    },

    /**
     * Leave a Network
     *
     * @param {String} networkId
     */
    'networks.leave': function(networkId) {
        check(networkId, String);

        var user = Meteor.user();
        var network = Networks.findOneOrFail(networkId);

        if (!network.hasMember(user._id)) {
            throw new Meteor.Error(400, 'user_is_not_a_member_of_network');
        }

        if (network.isNetworkAdmin(user._id)) {
            throw new Meteor.Error(400, 'network_admin_cant_leave_network');
        }

        try {
            network.leave(user._id);
            Event.emit('networks.uppers.removed', user, network);

            return {
                network_id: network._id,
                upper_id: user._id
            };
        } catch (error) {
            Log.error(error);
            throw new Meteor.Error(400, 'user_could_not_be_removed_from_network');
        }
    },

    /**
     * Remove an upper from a network as admin
     *
     * @param {String} networkId
     * @param {String} upperId
     */
    'networks.remove_upper': function(networkId, upperId) {
        check(networkId, String);
        check(upperId, String);

        var user = Meteor.user();
        var network = Networks.findOneOrFail(networkId);

        if (!network.isAdmin(user._id) || network.isNetworkAdmin(upperId)) {
            throw new Meteor.Error(401, 'unauthorized');
        }

        try {
            network.leave(upperId);
            Event.emit('networks.uppers.removed', user._id, network._id);

            return {
                network_id: network._id,
                upper_id: upperId
            };
        } catch (error) {
            Log.error(error);
            throw new Meteor.Error(400, 'user_could_not_be_removed_from_network');
        }
    },

    /**
     * Return a list of networks based on search query
     *
     * @param {String} query
     */
    'networks.autocomplete': function(query) {
        check(query, String);

        this.unblock();

        var user = Meteor.user();
        if (!user) {
            throw new Meteor.Error(401, 'unauthorized');
        }

        try {
            return Networks.guardedMetaFind({name: new RegExp('.*' + query + '.*', 'i')}, {limit: 30}).fetch();
        } catch (error) {
            Log.error(error);
            throw new Meteor.Error(400, 'networks_could_not_be_autocompleted');
        }
    },

    /**
     * Get user suggestions for a given network
     *
     * @param {String} networkId
     * @param {Object} options
     * @param {String} options.locationId
     * @param {String} options.query
     *
     * @return {Array}
     */
    'networks.user_suggestions': function(networkId, options) {
        check(networkId, String);
        check(options, {
            locationId: Match.Optional(String),
            query: Match.Optional(String)
        });

        this.unblock();

        var upper = Meteor.user();

        if (!upper) {
            throw new Meteor.Error(401, 'unauthorized');
        }

        var users = Partup.server.services.matching.matchUppersForNetwork(networkId, options);

        // We are returning an array of IDs instead of an object
        return users.map(function(user) {
            return user._id;
        });
    },

    /**
     * Remove a Network
     *
     * @param {String} networkId
     */
    'networks.remove': function(networkId) {
        check(networkId, String);

        var user = Meteor.user();
        if (!user || !User(user).isAdmin()) {
            throw new Meteor.Error(401, 'unauthorized');
        }

        var network = Networks.findOneOrFail(networkId);
        if (network.uppers.length > 1) {
            throw new Meteor.Error(400, 'network_contains_uppers');
        }

        var networkPartups = Partups.find({network_id: networkId});
        if (networkPartups.count() > 0) {
            throw new Meteor.Error(400, 'network_contains_partups');
        }

        try {
            Networks.remove(networkId);
            Meteor.users.update(user._id, {$pull: {networks: network._id}});

            return {
                _id: networkId
            };
        } catch (error) {
            Log.error(error);
            throw new Meteor.Error(400, 'network_could_not_be_removed');
        }
    },

    /**
     * Feature a specific network (superadmin only)
     *
     * @param {String} networkId
     * @param {mixed[]} fields
     */
    'networks.feature': function(networkId, fields) {
        check(networkId, String);
        check(fields, Partup.schemas.forms.featureNetwork);

        var user = Meteor.user();
        if (!user) throw new Meteor.Error(401, 'unauthorized');
        if (!User(user).isAdmin()) throw new Meteor.Error(401, 'unauthorized');

        var author = Meteor.users.findOne(fields.author_id);
        if (!author) throw new Meteor.Error(400, 'author does not exist');

        var featured = {
            'active': true,
            'by_upper': {
                '_id': author._id,
                'title': fields.job_title
            },
            'comment': fields.comment,
            'logo': fields.logo
        };

        try {
            Networks.update(networkId, {$set: {
                'featured': featured,
                'language': fields.language
            }});
        } catch (error) {
            Log.error(error);
            throw new Meteor.Error(400, 'network_could_not_be_featured');
        }
    },

    /**
     * Unfeature a specific network (superadmin only)
     *
     * @param {String} networkId
     */
    'networks.unfeature': function(networkId) {
        check(networkId, String);

        var user = Meteor.user();
        if (!user) throw new Meteor.Error(401, 'unauthorized');
        if (!User(user).isAdmin()) throw new Meteor.Error(401, 'unauthorized');

        try {
            Networks.update(networkId, {$unset: {'featured': ''}});
        } catch (error) {
            Log.error(error);
            throw new Meteor.Error(400, 'network_could_not_be_unfeatured');
        }
    },

    /**
     * Update privileged network fields (superadmin only)
     *
     * @param {String} networkSlug
     * @param {mixed[]} fields
     */
    'networks.admin_update': function(networkSlug, fields) {
        check(networkSlug, String);
        check(fields, Partup.schemas.forms.networkEdit);

        var user = Meteor.user();
        if (!user) throw new Meteor.Error(401, 'unauthorized');
        if (!User(user).isAdmin()) throw new Meteor.Error(401, 'unauthorized');

        var network = Networks.findOneOrFail({slug: networkSlug});

        if (fields.admin_id) {
            var adminUser = Meteor.users.findOneOrFail(fields.admin_id);
        }

        try {
            Networks.update(network._id, {$set: fields});
        } catch (error) {
            Log.error(error);
            throw new Meteor.Error(400, 'network_could_not_be_updated');
        }
    },

    /**
     * Consume an access token and add the user to the invites
     *
     * @param {String} networkSlug
     * @param {String} accessToken
     * */
    'networks.convert_access_token_to_invite': function(networkSlug, accessToken) {
        check(networkSlug, String);
        check(accessToken, String);

        var user = Meteor.user();
        var network = Networks.findOne({slug: networkSlug});

        try {
            network.convertAccessTokenToInvite(user._id, accessToken);
        } catch (error) {
            Log.error(error);
            throw new Meteor.Error(400, 'network_access_token_could_not_be_converted_to_invite');
        }
    }
});
