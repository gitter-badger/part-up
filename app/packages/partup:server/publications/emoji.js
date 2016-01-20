// Publish Emoji database

Meteor.publish('emojis', function(){
	return Emojis.find()
});
