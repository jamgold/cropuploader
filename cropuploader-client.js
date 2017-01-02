Template.cropUploader.onCreated(function(){
	var template = this;
	_.map(template.data, function(val,key){
		if(['thumbnailWidth', 'thumbnailHeight', 'canvasID', 'thumbnailID','allowURL','hideUpload'].indexOf(key) < 0)
		{
			if(template.addons == undefined) template.addons = {};
			template.addons[key] = val;
		}
	});
	if(CropUploader.debug) console.debug(template.view.name+'.created addons: ', template.addons, template.data);
	template.allowURL = template.data.allowURL === true;
	template.reader = new FileReader();
	template.imagePresent = new ReactiveVar(false);
	template.thumbnailID = template.data.thumbnailID || undefined;
	if(template.thumbnailID == undefined) template.thumbnailID = 'thumbnail_img';
	CropUploader.instance[template.thumbnailID] = template;
	template.processFile = function(file) {
		EXIF.getData(file,function() {
			// this = file
			if(CropUploader.debug) console.info('processFile EXIF',EXIF.pretty(this));
			template.orientation = EXIF.getTag(this,"Orientation");
			template.make = EXIF.getTag(this,"Make");
			//
			// pass our template.thumbnail_img into the reader.onload
			// so we can determine the md5hash
			//
			template.reader.onload = (function(aImg) { return function(e) {
				template.md5hash = MD5(e.target.result);
				// this will trigger image.onload in onRendered
				aImg.src = e.target.result;
				// template.$('input[type="url"]').val();
			}; })(template.thumbnail_img);
			template.reader.readAsDataURL(this);
		});
	}
});
Template.cropUploader.onRendered(function() {
	var template = this;
	template.orientation = 0;
	template.make = '';
	template.md5hash = null;
	template.thumbnailWidth = template.data.thumbnailWidth || undefined;
	template.thumbnailHeight = template.data.thumbnailHeight || undefined;
	template.canvasID = template.data.canvasID || undefined;
	// template.thumbnailID = template.data.thumbnailID || undefined;
	if(template.canvasID == undefined) template.canvasID = 'thumbnail_canvas';
	// if(template.thumbnailID == undefined) template.thumbnailID = 'thumbnail_img';

	if(template.thumbnailHeight == undefined)
		template.thumbnailHeight = 100;
	if(template.thumbnailWidth == undefined)
		template.thumbnailWidth = 100;

	template.preview = template.data.previewID ? template.find('#'+template.data.previewID) : template.find('#preview');

	if(!template.preview)
	{
		if(CropUploader.debug) console.debug('cropUploader added div#preview');
		template.preview = document.createElement('div');
		template.preview.id = 'preview';
		document.body.appendChild(template.preview);
	}

	template.thumbnail_img = template.find('#'+template.thumbnailID);
	if(!template.thumbnail_img)
	{
		if(CropUploader.debug) console.debug('creating #thumbnail_img');
		template.thumbnail_img = document.createElement('img');
		template.thumbnail_img.id = template.thumbnailID;
		template.thumbnail_img.classList.add('hidden');
		template.thumbnail_img.classList.add('thumbnail');
		// template.thumbnail_img.setAttribute('crossOrigin', 'anonymous');
		template.preview.appendChild(template.thumbnail_img);
	}

	template.thumbnailCanvas = template.find('#'+template.canvasID);
	if(!template.thumbnailCanvas)
	{
		template.thumbnailCanvas = document.createElement('canvas');
		template.thumbnailCanvas.id = template.canvasID;
		template.thumbnailCanvas.width = template.data.previewWidth ? template.data.previewWidth : template.thumbnailWidth;
		template.thumbnailCanvas.height = template.data.previewHeight ? template.data.previewHeight : template.thumbnailHeight;
		template.thumbnailCanvas.classList.add('hidden');
		template.thumbnailCanvas.classList.add('preview');
		template.preview.appendChild(template.thumbnailCanvas);
		if(CropUploader.debug) console.debug('created canvas '+template.canvasID);
	}
	// else
	// {
	// 	template.thumbnailCanvas.width = template.data.previewWidth ? template.data.previewWidth : template.thumbnailWidth;
	// 	template.thumbnailCanvas.height = template.data.previewHeight ? template.data.previewHeight : template.thumbnailHeight;
	// }
	//
	// everything will get loaded into the originalCanvas
	//
	template.originalCanvas = template.find('#'+template.canvasID+'_original');
	if(!template.originalCanvas)
	{
		template.originalCanvas = document.createElement('canvas');
		template.originalCanvas.id = template.canvasID+'_original';
		template.originalCanvas.setAttribute('imagePresent', false);
		template.originalCanvas.classList.add('hidden');
		template.preview.appendChild(template.originalCanvas);
		// $('.preview-canvas')[0].appendChild(template.originalCanvas);
		if(CropUploader.debug) console.debug('created canvas '+template.canvasID+'_original');
	}
	//
	// thumbnail_img.onload will handle the thumbnailification and orientation
	//
	template.thumbnail_img.onload = function cropUploaderImageOnload(e) {
		var thumbnail_dataUrl = template.thumbnail_img.src;
		// if(CropUploader.debug) console.info(`thumbnail_img.onload: ${template.make} ${template.orientation}`);
		if(CropUploader.debug) console.debug('cropUploaderImageOnload',e);
		var cc = {
			x: 0,
			y: 0,
			width: template.thumbnailCanvas.width,
			height: template.thumbnailCanvas.height
		};
		// console.log('thumbnailping', cc);
		template.originalCanvas.width = template.thumbnail_img.width;
		template.originalCanvas.height = template.thumbnail_img.height;

		template.original_ctx = template.originalCanvas.getContext('2d');
		if ( template.orientation ) {
			var orientation = template.orientation;
			template.original_ctx.save();
			var width  = template.originalCanvas.width;  var styleWidth  = template.originalCanvas.style.width;
			var height = template.originalCanvas.height; var styleHeight = template.originalCanvas.style.height;

		  if (orientation > 4) {
		    template.originalCanvas.width  = height; template.originalCanvas.style.width  = styleHeight;
		    template.originalCanvas.height = width;  template.originalCanvas.style.height = styleWidth;
		  }
		  switch (orientation) {
			  case 2: template.original_ctx.translate(width, 0);     template.original_ctx.scale(-1,1); break;
			  case 3: template.original_ctx.translate(width,height); template.original_ctx.rotate(Math.PI); break;
			  case 4: template.original_ctx.translate(0,height);     template.original_ctx.scale(1,-1); break;
			  case 5: template.original_ctx.rotate(0.5 * Math.PI);   template.original_ctx.scale(1,-1); break;
			  case 6: template.original_ctx.rotate(0.5 * Math.PI);   template.original_ctx.translate(0,-height); break;
			  case 7: template.original_ctx.rotate(0.5 * Math.PI);   template.original_ctx.translate(width,-height); template.original_ctx.scale(-1,1); break;
			  case 8: template.original_ctx.rotate(-0.5 * Math.PI);  template.original_ctx.translate(-width,0); break;
		  }
		}
		template.original_ctx.drawImage(template.thumbnail_img,0,0);
		//
		// check if we want to make it square
		//
		var sWidth = template.originalCanvas.width, sHeight = template.originalCanvas.height;
		//
		// are we requesting a square image
		//
		if(cc.width == cc.height) {
			//
			// make source square
			//
			if(sWidth>sHeight) sWidth=sHeight;
			else sHeight = sWidth;
		} else {
			//
			// make source same aspect ratio as cc (422 x 243) vs (2576 x 1932)
			//
			if(cc.width>cc.height) {
				// horizontal
				var d = cc.width / cc.height;
				sHeight = sHeight / d;
			} else {
				// vertical
				var d = cc.height / cc.width;
				sWidth = sWidth / d;
			}
		}
		//
		// get context for thumbnail
		//
		template.thumbnail_ctx = template.thumbnailCanvas.getContext("2d");
		//
		// resize/crop the adjusted original canvas
		// cc.width/height needs to be adjusted to the ascpect ratio of thumbnailCanvas
		// void ctx.drawImage(image, dx, dy);
		// void ctx.drawImage(image, dx, dy, dWidth, dHeight);
		// void ctx.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
		//
		template.thumbnail_ctx.drawImage(
			template.originalCanvas,// template.thumbnail_img,
			// source x/y w/h
			0,0,
			sWidth, sHeight,
			// reduce to canvas x/y w/h
			cc.x, cc.y,
			cc.width, cc.height
		);

		if(true || template.addons['previewShow'])
		{
			$('#'+template.thumbnailCanvas.id).trigger('onload');
		}
		// thumbnail_ctx = template.originalCanvas.getContext("2d");
		// thumbnail_ctx.drawImage(template.thumbnail_img,0,0);
		template.originalCanvas.setAttribute('imagePresent', true);
		template.imagePresent.set(true);
	}
});
Template.cropUploader.onDestroyed(function() {
	var template = this;
	// console.log(template.view.name+'.onDestroyed', template);
	delete CropUploader.instance[template.thumbnailID];
	$(template.thumbnailCanvas).remove();
	$(template.originalCanvas).remove();
	$(template.thumbnail_img).remove();
});
Template.cropUploader.events({
	// 'drop input.crop-uploader-file': function(e, template) {
	// 	console.log(e);
	// },
	'change input.crop-uploader-file': function(e, template) {
		template.$('input[type="url"]').val('');
		var file = template.$('input[type="file"]')[0].files[0];
		template.processFile(file);
		// EXIF.getData(file,function() {
		// 	// this = file
		// 	if(CropUploader.debug) console.info(EXIF.pretty(this));
		// 	template.orientation = EXIF.getTag(this,"Orientation");
		// 	template.make = EXIF.getTag(this,"Make");
		// 	//
		// 	// pass our template.thumbnail_img into the reader.onload
		// 	// so we can determine the md5hash
		// 	//
		// 	template.reader.onload = (function(aImg) { return function(e) {
		// 		template.md5hash = MD5(e.target.result);
		// 		// this will trigger image.onload in onRendered
		// 		aImg.src = e.target.result;
		// 		// template.$('input[type="url"]').val();
		// 	}; })(template.thumbnail_img);
		// 	template.reader.readAsDataURL(this);
		// });
	},
	'click button.crop-uploader-reset': function(e,template) {
		template.imagePresent.set(false);
		template.$('#'+template.canvasID).addClass('hidden');
		template.originalCanvas.setAttribute('imagePresent', false);
	},
	'click button.crop-uploader-upload': function(e,template) {
		// use the originalCanvas attribute because we do not want reactivity here
		var imagePresent = template.originalCanvas.getAttribute('imagePresent') == "true";
		var uuid = Meteor.uuid();
		
		e.preventDefault();

		CropUploader.errorMessage.set(null);
		//
		// this is not working because the canvas gets tainted when copying using the URL
		//
		if(imagePresent)
		{
			CropUploader.uploader = new Slingshot.Upload(CropUploader.name, {uuid: uuid });
			var thumbnailCanvas = template.thumbnailCanvas;// template.find('#'+template.canvasID);
			var originalCanvas = template.originalCanvas;
			if( thumbnailCanvas && thumbnailCanvas.toBlob && originalCanvas && originalCanvas.toBlob )
			{
				//
				// first save the blob (thumbnail)
				//
				thumbnailCanvas.toBlob(function(blob) {
					//
					// set the name which will get used in the uploader/key function
					//
					blob.name = 'derivative/thumbnail/';
					CropUploader.uploadingMessage.set('Thumbnail');
					CropUploader.uploading.set(true);
					CropUploader.uploader.send(blob, function (error, thumbnailUrl) {
						if (error) {
							console.error('Error uploading', CropUploader.uploader.xhr.response);
							// console.error(error);
							CropUploader.errorMessage.set('Error uploading:'+error.reason);
							CropUploader.uploading.set(false);
						} else {
							//
							// we have uploaded the thumbnail, so now upload original
							//
							originalCanvas.toBlob(function(blob){
								blob.name = uuid+'.png';
								var image = {
									name: blob.name
								};
								CropUploader.uploadingMessage.set('Original');
								CropUploader.uploader.send(blob, function(error, originalUrl){
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
										CropUploader.uploading.set(false);
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
										CropUploader.uploading.set(false);
										template.imagePresent.set(false);
										template.originalCanvas.setAttribute('imagePresent', false);
									}
								});
							},'image/png');
						}
					});
				}, 'image/png');
			} else console.log('canvas no blob');
		} else CropUploader.errorMessage.set('Please select file first');
	},
});
Template.cropUploader.helpers({
	allowedURL: function() {
		var instance = Template.instance();
		// console.log('allowedURL '+instance.allowURL);
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
			case 'dropbox':
				template = 'cropUploaderDropbox';
				break;
			case 'bootstrap':
				template = 'cropUploaderBootstrap';
				break;
			break;
		}
		return template;
	},
	data: function() {
		var data = Template.currentData();
		data.parentInstance = Template.instance();
		return data;
	}
});
Template.cropUploaderURL.onCreated(function(){
	var template = this;
	if(CropUploader.debug) console.debug(template.view.name+'.created: ', template.data);
	template.imagePresent = CropUploader.instance[template.data.thumbnailID].imagePresent;
})
Template.cropUploaderURL.events({
	'change input.crop-uploader-url': function(e, template) {
		var url = template.$('input[type="url"]').val();
		var thumbnailID = template.data && template.data.thumbnailID ? template.data.thumbnailID : null;
		// template.$('input[type="file"]').val('');
		if(thumbnailID) {
			template.md5hash = MD5(url);
			Meteor.call('cropUploaderUrl',url, function(err,res){
				if(!err) {
					CropUploader.instance[thumbnailID].thumbnail_img.src = res;
				} else {
					CropUploader.errorMessage.set(err.details);
				}
			});
		}
	},
});
Template.cropUploaderURL.helpers({
	imagePresent: function(){
		var template = Template.instance();
		// console.log(template.view.name+'.imagePresent', template);
		return template.imagePresent.get();
	}
});
Template.cropUploaderDropbox.onCreated(function(){
	var template = this;
	if(CropUploader.debug) console.debug(template.view.name+'.created: ', template.data);
	// template.imagePresent = CropUploader.instance[template.data.thumbnailID].imagePresent;
});
Template.cropUploaderDropbox.onRendered(function(){
	var template = this;
	var canvasID = template.data.canvasID;

	if(template.data.dropboxImage)
	{
		template.$('#dropboxImage').attr('src',template.data.dropboxImage);
	}
});
Template.cropUploaderDropbox.events({
	'onload canvas': function(e,t) {
		// console.log('onload canvas');
	    // t.$('#dropboxImage').addClass('hidden');
		t.$('#'+t.data.canvasID).removeClass('hidden');
		// t.$('input[type="url"]').addClass('hidden');
	},
	'uploaded canvas': function(e, t, payload) {
		// console.log('uploaded canvas');
		t.$('#'+t.data.canvasID).addClass('hidden');
	    // t.$('#dropboxImage').removeClass('hidden');
		// t.$('input[type="url"]').removeClass('hidden');
	}
});
Template.cropUploaderDropbox.helpers({
	width: function() {
		var template = Template.instance();
		return template.data.previewWidth ? template.data.previewWidth : template.data.thumbnailWidth;
	},
	height: function() {
		var template = Template.instance();
		return template.data.previewHeight ? template.data.previewHeight : template.data.thumbnailHeight;
	},
	imagePresent: function(){
		var template = Template.instance();
		return template.data.parentInstance.imagePresent.get();
	},
});
Template.cropUploaderFile.onRendered(function(){
	var template = this;
	var dropfile = template.find('#crop-uploader-label-'+template.data.thumbnailID);
	if(CropUploader.debug) console.info(template.view.name+'.rendered', dropfile);
	dropfile.addEventListener('dragover', function(e) {
	  e.preventDefault();
	  e.stopPropagation();
	  dropfile.classList.add('dragover');
	});
	dropfile.addEventListener('dragleave', function(e) {
	  e.preventDefault();
	  e.stopPropagation();
	  dropfile.classList.remove('dragover');
	});
	dropfile.addEventListener('drop', function(e) {
	  e.preventDefault();
	  e.stopPropagation();
	  dropfile.classList.remove('dragover');
	  var files;
      if(e.dataTransfer) {
        files = e.dataTransfer.files;
      } else if(e.target) {
        files = e.target.files;
      }
      template.data.parentInstance.processFile(files[0]);
	});
	if(isMobile)
		dropfile.addEventListener('click', function() {
		  template.$('#crop-uploader-file-'+template.data.thumbnailID).click();
		});
});
Template.cropUploaderFile.helpers({
	width: function() {
		var template = Template.instance();
		return template.data.previewWidth ? template.data.previewWidth : template.data.thumbnailWidth;
	},
	height: function() {
		var template = Template.instance();
		return template.data.previewHeight ? template.data.previewHeight : template.data.thumbnailHeight;
	},
});
Template.cropUploaderProgressBar.onDestroyed(function(){
	CropUploader.uploading.set(false);
});
Template.cropUploaderProgressBar.helpers({
	progress: function () {
		return CropUploader.uploader ? Math.round(CropUploader.uploader.progress() * 100) : 0;
	}
})
Template.cropUploaderImages.onRendered(function(){
	var template = this;
	template.subscribe('cropUploaderImages');
});
Template.cropUploaderImages.helpers({
	images: function() {
		return CropUploader.images.find();
	}
});
Template.cropUploaderCropper.onCreated(function () {
	var template = this;
	CropUploader.crop.template = template;
	//
	template.imageid = template.data.imageid;
	template.original = CropUploader.images.findOne({_id: template.data.imageid});
	template.uuid = template.original.url.split('/').pop().split('.').shift();
	template.thumbnailWidth = template.data.thumbnailWidth || undefined;
	template.thumbnailHeight = template.data.thumbnailHeight || undefined;
	template.aspectRatio = template.data.aspectRatio || 1.0;

	if(template.thumbnailHeight == undefined && template.thumbnailWidth == undefined)
	{
		template.thumbnailHeight = 100;
		template.thumbnailWidth = 100;
	}

	CropUploader.crop.options.aspectRatio = template.aspectRatio;
	CropUploader.crop.options.checkImageOrigin = navigator.userAgent.match(/9.*Safari/)!==null;
	CropUploader.crop.options.data.width = template.thumbnailWidth;
	CropUploader.crop.options.data.height = template.thumbnailHeight;

	// var options = {
	// 	aspectRatio: template.aspectRatio,
	// 	resizable: true,
	// 	rotatable: true,
	// 	scalable: true,
	// 	checkOrientation: true,
	// 	// minCanvasHeight: 500,
	// 	preview: ".img-preview",
	// 	data: {
	// 		x: 10,
	// 		y: 10,
	// 		width: template.thumbnailWidth,
	// 		height: template.thumbnailHeight
	// 	},
	// 	// dragend: function() {
	// 	//   console.log('dragend');
	// 	// },
	// 	built: function() {
	// 		// this is image
	// 		if(CropUploader.debug)
	// 			console.debug(template.view.name+'.onCreated built', CropUploader.crop.options);
	// 		template.$('button.hidden').removeClass('hidden');
	// 		template.$('#crop-image-loading').fadeOut();
	// 	}
	// };
	$.fn.cropper.setDefaults(CropUploader.crop.options);

	template.canvas = null;
	//
	//
	template.initCropper = function(template) {
		// if(!template.view.isRendered) return;
		if(CropUploader.debug) console.debug('initCropper');
		if(!template.original) throw new Meteor.Error(403, 'image not found');
		// console.log(template.data.exif);
		// save the cropper handle in the template
		// template.cropimage = template.$(".image-container > img");
		template.cropimage = template.$("#crop-image");
		//
		// initialize the cropper
		//
		template.cropimage.cropper(CropUploader.crop.options);
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
			if(CropUploader.debug) console.debug('img loaded');
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
