Template.cropUploader.onCreated(function(){
	var template = this;
	_.map(template.data, function(val,key){
		if(['thumbnailWidth', 'thumbnailHeight', 'canvasID', 'thumbnailID','allowURL','hideUpload'].indexOf(key) < 0)
		{
			if(template.addons == undefined) template.addons = {};
			template.addons[key] = val;
		}
	});
	if(Meteor.isDevelopment) console.debug(template.view.name+'.created', template.addons);

	template.allowURL = template.data.allowURL === true;

	template.reader = new FileReader();
});
Template.cropUploader.onRendered(function () {
	var template = this;
	template.md5hash = null;
	template.thumbnailWidth = template.data.thumbnailWidth || undefined;
	template.thumbnailHeight = template.data.thumbnailHeight || undefined;
	template.canvasID = template.data.canvasID || undefined;
	template.thumbnailID = template.data.thumbnailID || undefined;

	if(template.canvasID == undefined) template.canvasID = 'thumbnail_canvas';
	if(template.thumbnailID == undefined) template.thumbnailID = 'thumbnail_img';

	if(template.thumbnailHeight == undefined && template.thumbnailWidth == undefined)
	{
		template.thumbnailHeight = 100;
		template.thumbnailWidth = 100;
	}
	// console.info(template.view.name+'.rendered',this);

	template.preview = document.getElementById('preview');

	if(!template.preview)
	{
		if(Meteor.isDevelopment) console.debug('cropUploader added div#preview');
		template.preview = document.createElement('div');
		template.preview.id = 'preview';
		document.body.appendChild(template.preview);
	}

	template.thumbnail_img = document.getElementById(template.thumbnailID);
	if(!template.thumbnail_img)
	{
		if(Meteor.isDevelopment) console.debug('creating #thumbnail_img');
		template.thumbnail_img = document.createElement('img');
		template.thumbnail_img.id = template.thumbnailID;
		template.thumbnail_img.classList.add('hidden');
		template.thumbnail_img.classList.add('thumbnail');
		// template.thumbnail_img.setAttribute('crossOrigin', 'anonymous');
		template.preview.appendChild(template.thumbnail_img);
	}

	template.thumbnailCanvas = document.getElementById(template.canvasID);
	if(!template.thumbnailCanvas)
	{
		template.thumbnailCanvas = document.createElement('canvas');
		template.thumbnailCanvas.id = template.canvasID;
		template.thumbnailCanvas.width = template.thumbnailWidth;
		template.thumbnailCanvas.height = template.thumbnailHeight;
		template.thumbnailCanvas.classList.add('hidden');
		template.thumbnailCanvas.classList.add('preview');
		template.preview.appendChild(template.thumbnailCanvas);
	}
	else
	{
		template.thumbnailCanvas.width = template.thumbnailWidth;
		template.thumbnailCanvas.height = template.thumbnailHeight;
	}
	//
	// everything will get loaded into the originalCanvas
	//
	template.originalCanvas = document.getElementById(template.canvasID+'_original');
	if(!template.originalCanvas)
	{
		template.originalCanvas = document.createElement('canvas');
		template.originalCanvas.id = template.canvasID+'_original';
		template.originalCanvas.setAttribute('imagePresent', false);
		template.originalCanvas.classList.add('hidden');
		template.preview.appendChild(template.originalCanvas);
		if(Meteor.isDevelopment) console.debug('created '+template.canvasID+'_original');
	}
	//
	// thumbnail_img.onload will handle the thumbnailification
	//
	this.thumbnail_img.onload = function(e) {
		var thumbnail_dataUrl = template.thumbnail_img.src;
		// console.log('thumbnailping');
		var cc = {
			x: 0,
			y: 0,
			width: template.thumbnail_img.width,
			height: template.thumbnail_img.height
			// width: template.thumbnailCanvas.width,
			// height: template.thumbnailCanvas.height
		};
		template.originalCanvas.width = template.thumbnail_img.width;
		template.originalCanvas.height = template.thumbnail_img.height;
		//
		// check if we want to make it square
		//
		if(template.thumbnailWidth == template.thumbnailHeight)
		{
			if (cc.height > cc.width) {
				cc.height = cc.width;
			}
			else
			{
				cc.width = template.thumbnail_img.height;
			}
			template.thumbnailCanvas.width = template.thumbnailWidth;
			template.thumbnailCanvas.height= template.thumbnailHeight;
		}
		else
		{
			if(template.thumbnailWidth != undefined)
				template.thumbnailCanvas.height = template.thumbnailWidth * cc.height/cc.width;
			else
				template.thumbnailCanvas.width = template.thumbnailHeight * cc.width/cc.height;
		}
		// console.log('thumbnail cropping',cc);
		var thumbnail_ctx = template.thumbnailCanvas.getContext("2d");
		//
		// resize/crop the original for the thumbnail
		//
		thumbnail_ctx.drawImage(
			template.thumbnail_img,
			// original x/y w/h
			cc.x, cc.y,
			cc.width, cc.height,
			// reduce to canvas x/y w/h
			0,0,
			template.thumbnailCanvas.width, template.thumbnailCanvas.height
		);
		if(true || template.addons['previewShow'])
		{
			$('#'+template.thumbnailCanvas.id).trigger('onload');
		}
		thumbnail_ctx = template.originalCanvas.getContext("2d");
		thumbnail_ctx.drawImage(template.thumbnail_img,0,0);
		template.originalCanvas.setAttribute('imagePresent', true);
	}
});
Template.cropUploader.onDestroyed(function() {
	var template = this;
	// console.log(template.view.name+'.onDestroyed', template);
	$(template.thumbnailCanvas).remove();
	$(template.originalCanvas).remove();
	$(template.thumbnail_img).remove();
});
Template.cropUploader.events({
	'change input.crop-uploader-url': function(e, template) {
		var url = template.$('input[type="url"]').val();
		template.$('input[type="file"]').val('');
		template.md5hash = MD5(url);
		Meteor.call('cropUploaderUrl',url, function(err,res){
			if(!err) $('#thumbnail_img').attr('src',res);//.removeClass('hidden');
			else CropUploader.errorMessage.set('Could not load URL');
		});
		// template.thumbnail_img.src = url;
	},
	'change input.crop-uploader-file': function(e, template) {
		var file = template.$('input[type="file"]')[0].files[0];
		template.$('input[type="url"]').val('');
		//
		// pass our template.thumbnail_img into the reader.onload
		// so we can determine the md5hash
		//
		template.reader.onload = (function(aImg) { return function(e) {
			template.md5hash = MD5(e.target.result);
			aImg.src = e.target.result;
			template.$('input[type="url"]').val();
		}; })(template.thumbnail_img);
		template.reader.readAsDataURL(file);
	},
	'click button.crop-uploader-upload': function(e,template) {
		var imagePresent = template.originalCanvas.getAttribute('imagePresent');
		var uuid = Meteor.uuid();
		
		e.preventDefault();

		CropUploader.errorMessage.set(null);
		//
		// this is not working because the canvas gets tainted when copying using the URL
		//
		if(imagePresent)
		{
			var uploader = new Slingshot.Upload(CropUploader.name, {uuid: uuid });
			var canvas = document.getElementById(template.canvasID);
			if(canvas && canvas.toBlob)
			{
				//
				// first save the blob (thumbnail)
				//
				canvas.toBlob(function(blob) {
					//
					// set the name which will get used in the uploader/key function
					//
					blob.name = 'derivative/thumbnail/';

					uploader.send(blob, function (error, thumbnailUrl) {
						if (error) {
							console.error('Error uploading', uploader.xhr.response);
							console.error(error);
							CropUploader.errorMessage.set('Error uploading:'+error.reason);
						} else {
							//
							// we have uploaded the thumbnail, so now upload original
							//
							canvas = document.getElementById(template.originalCanvas.id);
							canvas.toBlob(function(blob){
								blob.name = uuid+'.png';
								var image = {
									name: blob.name
								};
								uploader.send(blob, function(error, originalUrl){
									if(error)
									{
										// Log service detailed response
										console.error('Error uploading', uploader.xhr.response);
										console.error(error);
										CropUploader.errorMessage.set('Error uploading:'+error.reason);
										// we need to delete the derivative
										Meteor.call('cropUploaderS3Delete', thumbnailUrl, function(err, res){
											if(err) console.err(err);
										});
									}
									else
									{
										// console.log('uploaded blob: '+originalUrl);
										//
										// add uuid and md5hash to image object
										//
										image.uuid = uuid;
										image.md5hash = template.md5hash;
										image.url = originalUrl;
										//
										// add our derivatives
										//
										image.derivatives = {
											thumbnail: thumbnailUrl
										};
										if(template.addons)
										{
											image = _.extend(image, template.addons);
										}
										//
										// finally add it to the collection
										//
										CropUploader.insert(image);
										//
										// clear the thumbnailCanvas
										//
										var thumbnail_ctx = template.thumbnailCanvas.getContext("2d");
										thumbnail_ctx.clearRect(0, 0, template.thumbnailCanvas.width, template.thumbnailCanvas.height);
										//
										// trigger onclear on thumbnailCanvas
										//
										$('#'+template.thumbnailCanvas.id).trigger('onclear');
										//
										// trigger uploaded so client can act on it
										//
										$('#'+template.canvasID).trigger('uploaded', image);

										CropUploader.errorMessage.set('');
									}
								});
							},'image/png');
						}
					});
				}, 'image/png');
			} else console.log('canvas no blob');
		} else CropUploader.errorMessage.set('Please select file first');
		// var file = template.$('input.crop-uploader-file');
		// if(file.size()>0 && file[0].files.length > 0)
		// {
		// 	var image = file[0].files[0];
		// 	var uploader = new Slingshot.Upload(CropUploader.name, {uuid: uuid });

		// 	//template.reader.onload = function(e) {
		// 		//
		// 		// e.target.result contains the image data of the original
		// 		//
		// 		// var md5hash = MD5(e.target.result);
		// 		var canvas = document.getElementById(template.canvasID);
		// 		if(canvas && canvas.toBlob)
		// 		{
		// 			//
		// 			// first save the blob (thumbnail)
		// 			//
		// 			canvas.toBlob(function(blob) {
		// 				//
		// 				// set the name which will get used in the uploader/key function
		// 				//
		// 				blob.name = 'derivative/thumbnail/';

		// 				uploader.send(blob, function (error, thumbnailUrl) {
		// 					if (error) {
		// 						console.error('Error uploading', uploader.xhr.response);
		// 						console.error(error);
		// 						CropUploader.errorMessage.set('Error uploading:'+error.reason);
		// 					} else {
		// 						//
		// 						// we have uploaded the thumbnail, so now upload original
		// 						//
		// 						uploader.send(image, function (error, originalUrl) {
		// 							if (error) {
		// 								// Log service detailed response
		// 								console.error('Error uploading', uploader.xhr.response);
		// 								console.error(error);
		// 								CropUploader.errorMessage.set('Error uploading:'+error.reason);
		// 								// we need to delete the derivative
		// 								Meteor.call('cropUploaderS3Delete', thumbnailUrl, function(err, res){
		// 									if(err) console.err(err);
		// 								})
		// 							} else {
		// 								//
		// 								// add uuid and md5hash to image object
		// 								//
		// 								image.uuid = uuid;
		// 								image.md5hash = template.md5hash;
		// 								image.url = originalUrl;
		// 								//
		// 								// add our derivatives
		// 								//
		// 								image.derivatives = {
		// 									thumbnail: thumbnailUrl
		// 								};
		// 								if(template.addons)
		// 									image = _.extend(image, template.addons);
		// 								//
		// 								// finally add it to the collection
		// 								//
		// 								CropUploader.insert(image);
		// 								file.val('');
		// 								//
		// 								// clear the thumbnailCanvas
		// 								//
		// 								var thumbnail_ctx = template.thumbnailCanvas.getContext("2d");
		// 								thumbnail_ctx.clearRect(0, 0, template.thumbnailCanvas.width, template.thumbnailCanvas.height);
		// 								//
		// 								// trigger onclear on thumbnailCanvas
		// 								//
		// 								$('#'+template.thumbnailCanvas.id).trigger('onclear');
		// 								//
		// 								// trigger uploaded so client can act on it
		// 								//
		// 								$('#'+template.canvasID).trigger('uploaded', image);

		// 								CropUploader.errorMessage.set('');
		// 							}
		// 						});
		// 					}
		// 				});
		// 			}, 'image/png');
		// 		} else console.log('canvas no blob');
		// 	// };
		// 	//
		// 	// in order to get the MD5 for the image, we need to read it on the client
		// 	//
		// 	// template.reader.readAsDataURL(image);
		// } else CropUploader.errorMessage.set('Please select file first');
	},
});
Template.cropUploader.helpers({
	allowURL: function() {
		var instance = Template.instance();
		return instance.allowURL;
	},
	hideUpload: function() {
		var instance = Template.instance();
		return instance.hideUpload;
	},
	cropUploaderTemplate: function() {
		// console.log(this);
		var template = 'cropUploaderPlain';
		var request = this.template || '';
		switch(request.toLowerCase()) {
			case 'bootstrap':
				template = 'cropUploaderBootstrap';
			break;
		}
		return template;
	}
});
Template.cropUploaderImages.onRendered(function(){
	var template = this;
	template.subscribe('cropUploaderImages');
});
Template.cropUploaderImages.helpers({
	images: function() {
		return CropUploader.images.find();
	}
});
// Template.cropUploaderImages.events({
// 	'mouseenter img':function(e,t) {
// 		var image = CropUploader.images.findOne(e.target.id);
// 		if(image) {
// 			$('html').css({
// 				background: 'url('+image.url+') no-repeat center center fixed',
// 				backgroundSize: 'cover'
// 			})
// 		}
// 	},
// 	'mouseleave img': function(e,t) {
// 		$('html').css('background','none');
// 	},
// 	'click img': function(e,t) {
// 		if(confirm('Delete this image?'))
// 		{
// 			CropUploader.images.remove(e.target.id);
// 		}
// 	}
// });
Template.cropUploaderCropper.onCreated(function () {
	var template = this;
	CropUploader.crop.template = template;
	//
	template.imageid = template.data.imageid;
	template.original = CropUploader.images.findOne({_id: template.data.imageid});
	template.uuid = template.original.url.split('/').pop().split('.').shift();
	template.thumbnailWidth = template.data.thumbnailWidth || undefined;
	template.thumbnailHeight = template.data.thumbnailHeight || undefined;

	if(template.thumbnailHeight == undefined && template.thumbnailWidth == undefined)
	{
		template.thumbnailHeight = 100;
		template.thumbnailWidth = 100;
	}

	var options = {
		aspectRatio: 1.0,
		resizable: true,
		rotatable: true,
		checkImageOrigin: navigator.userAgent.match(/9.*Safari/)!==null,
		preview: ".img-preview",
		data: {
			x: 10,
			y: 10,
			width: template.thumbnailWidth,
			height: template.thumbnailHeight
		},
		// dragend: function() {
		//   console.log('dragend');
		// },
		built: function() {
			// this is image
			if(Meteor.isDevelopment) console.debug('cropper built' );
			template.$('button.hidden').removeClass('hidden');
			//
			// this will distort getDataURL
			//
			// if(template.data.exif.Orientation && template.data.exif.Orientation == 'bottom-right')
			//   template.$('img').addClass(template.data.exif.Orientation);
		}
	};
	$.fn.cropper.setDefaults(options);

	template.canvas = null;
	//
	//
	this.initCropper = function(template) {
		// if(!template.view.isRendered) return;
		if(Meteor.isDevelopment) console.debug('initCropper');
		if(!template.original) throw new Meteor.Error(403, 'image not found');
		// console.log(template.data.exif);
		// save the cropper handle in the template
		// template.cropimage = template.$(".image-container > img");
		template.cropimage = template.$("#crop-image");
		// template.cropimage[0].onload = function(){
		//   template.cropimagedimensions = {
		//     width: template.cropimage[0].width,
		//     height: template.cropimage[0].height
		//   };
		// };
		// add the checkImageOrigin for AppleWebKit
		// if(isWebKit) options['checkImageOrigin'] = true;//'Anonymous';
		//
		// initialize the cropper
		//
		template.cropimage.cropper(options);
	}
});
Template.cropUploaderCropper.onRendered(function () {
	var template = this;
	var canvas = document.createElement("canvas"),
			ctx = canvas.getContext("2d"),
			src = template.data.url, // insert image url here
			img = new Image
	 ;
	img.crossOrigin = "Anonymous";
	//
	// this is the key for fucking Safari cache, which 
	// reports cross domain issues
	//
	src += '?safariCacheFix='+Date.now();

	template.cropimage = template.$('#crop-image');

	Tracker.afterFlush(function () {
		// template.initCropper(template);
		img.onload = function() {
			if(Meteor.isDevelopment) console.debug('img loaded');
				canvas.width = img.width;
				canvas.height = img.height;
				ctx.drawImage( img, 0, 0 );
				var dataUrl = canvas.toDataURL("image/png");
				template.cropimage.attr('src', dataUrl ).cropper();
				// template.initCropper(template);
		};
		img.src = src;
	});
});
Template.cropUploaderCropper.onDestroyed( function () {
	var template = this;
	CropUploader.crop.template = null;
	template.cropimage = undefined;
});
