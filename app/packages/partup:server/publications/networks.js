/**
 * Publish a list of networks
 */
Meteor.publishComposite('networks.list', function() {
    this.unblock();

    return {
        find: function() {
            return Networks.guardedFind(this.userId);
        },
        children: [
            {find: Images.findForNetwork}
        ]
    };
});

/**
 * Publish a list of open-for-user-networks ordered by upper_count
 */
Meteor.publishComposite('networks.discoverfilter', function(urlParams, parameters, user) {
    if (this.unblock) this.unblock();

    var userId = user ? user._id : this.userId;

    return {
        find: function() {
            return Networks.findForDiscoverFilter(userId);
        },
        children: [
            {find: Images.findForNetwork}
        ]
    };
}, {url: 'networks-discoverfilter', getArgsFromRequest: function(request) {
    return [request.params, request.query, request.user];
}});

/**
 * Publish a network
 *
 * @param {String} networkSlug
 */
Meteor.publishComposite('networks.one', function(networkSlug) {
    check(networkSlug, String);

    if (this.unblock) this.unblock();

    return {
        find: function() {
            return Networks.guardedMetaFind({slug: networkSlug}, {limit: 1});
        },
        children: [
            {find: Images.findForNetwork},
            {find: Invites.findForNetwork},
            {
                find: function() {
                    return Networks.guardedFind(this.userId, {slug: networkSlug}, {limit: 1});
                }
            }
        ]
    };
});

/**
 * Publish all partups in a network
 *
 * @param {Object} urlParams
 * @param {Object} parameters
 */
Meteor.publishComposite('networks.one.partups', function(urlParams, parameters) {
    if (this.unblock) this.unblock();

    check(urlParams, {
        slug: Match.Optional(String),
    });

    parameters = parameters || {};
    if (parameters.limit) parameters.limit = parseInt(parameters.limit);
    if (parameters.skip) parameters.skip = parseInt(parameters.skip);

    check(parameters, {
        limit: Match.Optional(Number),
        skip: Match.Optional(Number),
        userId: Match.Optional(String),
    });

    var options = {};
    if (parameters.limit) options.limit = parameters.limit;
    if (parameters.skip) options.skip = parameters.skip;

    return {
        find: function() {
            var network = Networks.guardedFind(this.userId, {slug: urlParams.slug}).fetch().pop();
            if (!network) return;

            return Partups.findForNetwork(network, {}, options, this.userId);
        },
        children: [
            {find: Images.findForPartup},
            {find: Meteor.users.findUppersForPartup, children: [
                {find: Images.findForUser}
            ]},
            {find: function(partup) { return Networks.findForPartup(partup, this.userId); },
            children: [
                {find: Images.findForNetwork}
            ]}
        ]
    };
}, {url: 'networks/:slug/partups', getArgsFromRequest: function(request) {
    return [request.params, request.query];
}});

/**
 * Publish all uppers in a network
 *
 * @param {Object} urlParams
 * @param {Object} parameters
 */
Meteor.publishComposite('networks.one.uppers', function(urlParams, parameters) {
    if (this.unblock) this.unblock();

    check(urlParams, {
        slug: Match.Optional(String),
    });

    parameters = parameters || {};
    if (parameters.limit) parameters.limit = parseInt(parameters.limit);
    if (parameters.skip) parameters.skip = parseInt(parameters.skip);

    check(parameters, {
        limit: Match.Optional(Number),
        skip: Match.Optional(Number),
        userId: Match.Optional(String),
    });

    var options = {};
    if (parameters.limit) options.limit = parameters.limit;
    if (parameters.skip) options.skip = parameters.skip;

    return {
        find: function() {
            var network = Networks.guardedFind(this.userId, {slug: urlParams.slug}).fetch().pop();
            if (!network) return;

            return Meteor.users.findUppersForNetwork(network, options);
        },
        children: [
            {find: Images.findForUser}
        ]
    };
}, {url: 'networks/:slug/uppers', getArgsFromRequest: function(request) {
    return [request.params, request.query];
}});

/**
 * Publish all pending uppers in a network
 *
 * @param {String} networkSlug
 */
Meteor.publishComposite('networks.one.pending_uppers', function(networkSlug) {
    this.unblock();

    return {
        find: function() {
            var network = Networks.guardedFind(this.userId, {slug: networkSlug}).fetch().pop();
            if (!network) return;

            var pending_uppers = network.pending_uppers || [];
            var users = Meteor.users.findMultiplePublicProfiles(pending_uppers);

            return users;
        },
        children: [
            {find: Images.findForUser}
        ]
    };
});

/**
 * Publish all featured partups
 */
Meteor.publishComposite('networks.featured_all', function(language) {
    check(language, Match.Optional(String));

    if (this.unblock) this.unblock();

    return {
        find: function() {
            return Networks.findFeatured(language);
        },
        children: [
            {find: Images.findForNetwork},
            {find: function(network) {
                if (!get(network, 'featured.active')) return;
                return Meteor.users.findSinglePublicProfile(network.featured.by_upper._id);
            }, children: [
                {find: Images.findForUser}
            ]},
        ]
    };
}, {url: '/networks/featured/:0'});


/**
 * Publish all networks for admin panel
 */
Meteor.publishComposite('networks.admin_all', function() {
    this.unblock();

    var user = Meteor.users.findOne(this.userId);
    if (!User(user).isAdmin()) return;

    return {
        find: function() {
            return Networks.find({});
        },
        children: [
            {find: Images.findForNetwork},
            {find: function(network) {
                return Meteor.users.findSinglePublicProfile(network.admin_id);
            }, children: [
                {find: Images.findForUser}
            ]},
        ]
    };
});
