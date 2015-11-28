MySlingShotName = 'cropuploader';
MyDirectory = Meteor.isDevelopment ? 'slingshot' : 'demo';

Slingshot.fileRestrictions(MySlingShotName, {
  allowedFileTypes: ["image/png", "image/jpeg", "image/gif"],
  maxSize: 10 * 1024 * 1024 // 10 MB (use null for unlimited)
});

if(Meteor.isClient)
{
	CropUploader.init(MySlingShotName, MyDirectory);

	// counter starts at 0
	Session.setDefault('counter', 0);
	Session.setDefault('template', 'hello');

	Template.registerHelper('template',function(){
	  return Session.get('template');
	});

	Template.hello.helpers({
	  counter: function () {
		return Session.get('counter');
	  },
	});

	Template.hello.events({
	  'click button.hello': function () {
		// increment the counter when button is clicked
		Session.set('counter', Session.get('counter') + 1);
		Meteor.call('s3contents','slingshot', function(err,res){
		  if(!err) res.forEach(function(obj){
			console.log(obj.Key);
		  });
		});
	  },
	});

	// Template.cropper.
	Template.images.onCreated(function(){
		this.subscribe('cropUploaderImages');
	})
	Template.images.onRendered(function(){
	  this.$('.preview').addClass('hidden');
	});
	Template.images.helpers({
	  images: function() {
		return CropUploader.images.find();
	  }
	});
	Template.images.events({
	  // 'mouseenter img':function(e,t) {
	  //   var image = CropUploader.images.findOne(e.target.id);
	  //   if(image) {
	  //     $('html').css({
	  //       background: 'url('+image.url+') no-repeat center center fixed',
	  //       backgroundSize: 'cover'
	  //     })
	  //   }
	  // },
	  // 'mouseleave img': function(e,t) {
	  //   $('html').css('background','none');
	  // },
	  'click img': function(e,t) {
		// if(confirm('Delete this image?'))
		// {
		//   CropUploader.images.remove(e.target.id);
		// }
		// Session.set('image', CropUploader.images.findOne( e.target.id) );
		Session.set('image', e.target.id);
		Session.set('template', 'image');
	  }
	});

	Template.image.onCreated(function(){
		this.subscribe('cropUploaderImages',{_id: Session.get('image')});
	});
	Template.image.onDestroyed(function(){
		$('html').css('background','none');
	});
	Template.image.events({
		'click button.back': function () {
			Session.set('template', 'hello');
		},
		'click button.crop': function () {
			Session.set('template', 'cropper');
		},
		'click button.delete': function(e,t) {
			if(confirm('Delete this image?'))
			{
			  var imageid = t.$(e.target).attr('imageid');
			  CropUploader.images.remove(imageid, function(err,res){
			  	if(err) console.log(err);
		  		else Session.set('template', 'hello');
			  });
			}
		},
	});
	Template.image.helpers({
		image: function() {
			var image = CropUploader.images.findOne( Session.get('image') );
			if(image)
			$('html').css({
				background: 'url('+image.url+') no-repeat center center fixed',
				backgroundSize: 'contain'
			});
		},
		imageid: function() {
			var image = CropUploader.images.findOne( Session.get('image') );
			return image ? image._id : null;
		},
		canEditImage: function() {
			var image = CropUploader.images.findOne( Session.get('image') );
			return image ? image.userId == Meteor.userId() : false;
		}
	});

	Template.cropper.onCreated(function(){
		this.subscribe('cropUploaderImages',{_id: Session.get('image')});
		this.image = CropUploader.images.findOne( Session.get('image') );
	});
	Template.cropper.helpers({
	  imageid: function() {
		return Session.get('image');
	  },
	  url: function() {
	  	var image = CropUploader.images.findOne( Session.get('image') );
	  	// var template = Template.instance();
		return image ? image.url : '';
	  },
	  canSaveDerivative: function() {
	  	var image = CropUploader.images.findOne( Session.get('image') );
	  	return image ? image.userId == Meteor.userId() : false;
	  }
	});
	Template.cropper.events({
	  'click button.back': function(){
		Session.set('template', 'image');
	  },
	  'click button.save': function(e,t) {
		CropUploader.crop.save('thumbnail');
	  },
	  'click button.rotate': function(e,t) {
		CropUploader.crop.rotate();
	  }
	});

	CropUploader.init(MySlingShotName, 'demo');
}

if(Meteor.isServer)
{
	Slingshot.createDirective(MySlingShotName, Slingshot.S3Storage, {
	  bucket: Meteor.settings.S3Bucket,
	  region: Meteor.settings.region,
	  AWSAccessKeyId: Meteor.settings.awsAccessKeyId,
      AWSSecretAccessKey: Meteor.settings.awsSecretKey,
	  acl: "public-read",
	  authorize: function () {
		// Deny uploads if user is not logged in.
		if (!this.userId) {
		  var message = "Please login before posting files";
		  throw new Meteor.Error("Login Required", message);
		}
		return true;
	  },
	  key: function(file) {  }
	});

	CropUploader.init(MySlingShotName, MyDirectory);
}