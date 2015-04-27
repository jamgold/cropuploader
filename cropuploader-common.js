// Slingshot.fileRestrictions("cropUploader", {
//   allowedFileTypes: ["image/png", "image/jpeg", "image/gif"],
//   maxSize: 10 * 1024 * 1024 // 10 MB (use null for unlimited)
// });

CropUploader = {
	images: new Meteor.Collection('images'),
	name: 'cropUploader',
	urlBase: null,
	replaceDerivative:function(imageId, name, derivative) {
		var self = this;
		// console.log( derivative );
		check(imageId, String);
		check(name, String);
		// derivative needs to be File or Blob
		if (! (derivative instanceof window.File) && ! (derivative instanceof window.Blob))
			throw new Meteor.Error("The derivative to replace must be File or Blob");
		// check(derivative, Blob);
		var image = self.images.findOne(imageId);
		if(!image) throw new Meteor.Error(401, "the provided image does not exist");
		if(image.userId != Meteor.userId()) throw new Meteor.Error(403, "you don't have permission to replace derivative for "+imageid);
		//
		// setup slingshot with uuid from parent
		//
		var uploader = new Slingshot.Upload(self.name, {uuid: image.uuid });
		var oldfile = name in image['derivatives'] ? image['derivatives'][name] : null;
		// set name of blob so it will put in the right place
		derivative.name = 'derivative/'+name+'/';
		uploader.send(derivative, function (error, thumbnailUrl) {
		  if (error) {
			console.error('Error uploading', uploader.xhr.response);
			alert (error);
		  } else {
			//
			// update the collection object
			//
			var set = {}
			set['derivatives.'+name] = thumbnailUrl;
			self.images.update(image._id,{$set: set}, function(err,res){
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
		});
	},
	crop: {
		template: null,
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
				CropUploader.replaceDerivative( imageid, type, blob );
			  },'image/png');
			} else console.log('no canvas', self.template.canvas);
		},
		rotate: function() {
			var self = this;
			self.template.cropimage.cropper('rotate',90);
		}
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