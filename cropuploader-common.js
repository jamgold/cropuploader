// Slingshot.fileRestrictions("cropUploader", {
//   allowedFileTypes: ["image/png", "image/jpeg", "image/gif"],
//   maxSize: 10 * 1024 * 1024 // 10 MB (use null for unlimited)
// });
CropUploader = {
	images: new Meteor.Collection('images'),
	name: 'cropUploader',
	urlBase: null,
	uploader: null,
	uploading: new ReactiveVar(false),
	uploadingMessage: new ReactiveVar(''),
	instance: {},
	debug: false,
	derivative: {
		replace:function(imageid, name, derivative) {
			var self = this;
			// console.log( derivative );
			check(imageid, String);
			check(name, String);
			var userId = Meteor.userId();
			// derivative needs to be File or Blob
			if (! (derivative instanceof window.File) && ! (derivative instanceof window.Blob))
				throw new Meteor.Error("The derivative to replace must be File or Blob");
			// check(derivative, Blob);
			var image = CropUploader.images.findOne(imageid);
			if(!image) throw new Meteor.Error(401, "the provided image does not exist");
			if(!Roles.userIsInRole(userId, 'admin') && image.userId != userId)
				throw new Meteor.Error(403, "you don't have permission to replace derivative for "+imageid);
			//
			// setup slingshot with uuid from parent
			//
			CropUploader.uploader = new Slingshot.Upload(CropUploader.name, {uuid: image.uuid });
			var oldfile = name in image['derivatives'] ? image['derivatives'][name] : null;
			// set name of blob so it will put in the right place
			derivative.name = 'derivative/'+name+'/';
			CropUploader.uploadingMessage.set('New '+name);
			CropUploader.uploading.set(true);
			CropUploader.uploader.send(derivative, function (error, thumbnailUrl) {
			  if (error) {
				console.error('Error uploading', CropUploader.uploader.xhr.response);
				alert (error);
			  } else {
				//
				// update the collection object
				//
				var set = {}
				set['derivatives.'+name] = thumbnailUrl;
				CropUploader.images.update(image._id,{$set: set}, function(err,res){
					if(err) console.error(err);
					else console.log('uploaded and updated', res);
				});
				//
				// this should actually happen in the allow.update
				//
				if(oldfile)
				{
					// console.log('delete', oldfile);
					Meteor.call('cropUploaderS3Delete', oldfile, function (error, result) {
						if(error) console.err(error);
					});
				}
			  }
			  CropUploader.uploading.set(false);
			});
		},
	},
	_hooks: {},
	hooks: function(hooks) {
		var self = this;
		self._hooks = hooks;
	},
	insert:function(image) {
		var self = this;
		if('insert' in self._hooks && typeof self._hooks.insert == 'function')
			image = self._hooks.insert(image);
		if(image) {
			CropUploader.images.insert( image );
		}
	},
	crop: {
		template: null,
		options: {
			aspectRatio: 1.0,
			resizable: true,
			rotatable: true,
			scalable: true,
			dragMode: 'move',
			checkOrientation: true,
			// minCanvasHeight: 500,
			// checkImageOrigin: navigator.userAgent.match(/9.*Safari/)!==null,
			preview: ".img-preview",
			data: {
				x: 10,
				y: 10,
				// width: template.thumbnailWidth,
				// height: template.thumbnailHeight
			},
			built: function() {
				// this is image
				if(Meteor.isDevelopment)
					console.debug(CropUploader.crop.template.view.name+'.onCreated built', CropUploader.crop.options);
				CropUploader.crop.template.$('button.hidden').removeClass('hidden');
				CropUploader.crop.template.$('#crop-image-loading').fadeOut();
			}
		},
		save: function(type) {
			var self = this;
			var imageid = self.template.imageid;
			type = type || 'thumbnail';
			self.template.canvas = self.template.cropimage.cropper('getCroppedCanvas',{
			  width: self.template.data.thumbnailWidth,
			  height: self.template.data.thumbnailHeight
			});

			if(self.template.canvas && self.template.canvas.toBlob)
			{
			  self.template.canvas.toBlob(function(blob){
				CropUploader.derivative.replace( imageid, type, blob );
			  },'image/png');
			} else console.log('no canvas', self.template.canvas);
		},
		rotate: function() {
			var self = this;
			self.template.cropimage.cropper('rotate',90);
		},
		zoom: function(v) {
			v = v || 0.1;
			var self = this;
			self.template.cropimage.cropper('zoom',v);
		},
	},
	init: function(name, directory, consolidate) {
		var self = this;
		directory = directory || '';
		consolidate = consolidate || false;
		check(name, String);
		check(directory, String);
		check(consolidate, Boolean);
		if(directory.length>0 && directory[directory.length-1]!="/") directory+='/';
		self.directory = directory;
		self.name = name;
		// console.log('init', self.directory);
		if(Meteor.isServer)
		{
			var Knox = Npm.require("knox");
			var directive = Slingshot.getDirective(self.name);
			// console.log(directive._directive.region);
			self.knox = Knox.createClient({
				key: directive._directive.AWSAccessKeyId,
				secret: directive._directive.AWSSecretAccessKey,
				region: directive._directive.region,
				bucket: directive._directive.bucket,
			});
			directive._directive.key = function (file, meta) {
				// file
				// {
				//  name: '11075296_10152631810352261_1337077077459889796_n.jpg',
				//  size: 17224,
				//  type: 'image/jpeg'
				// }
				// console.log(file, meta);
				var ext = file.type.split('/')[1];
				if(file.name.match('derivative/'))
				{
					var d = new Date().getTime();
					return CropUploader.directory + file.name + meta.uuid +'.'+d+'.'+ext;
				}
				else
				{
					return CropUploader.directory+meta.uuid+'.'+ext;
				}
			}
			if(consolidate) Meteor.call('cropUploaderConsolidate');
		}
	}
};

if(Meteor.isClient)
{
	CropUploader.errorMessage = new ReactiveVar('');
	Template.registerHelper('CropUploader', function(){
		return {
			uploading: function() {
				return CropUploader.uploading.get();
			},
			message: function() {
				return CropUploader.uploadingMessage.get();
			},
		};
	});
}