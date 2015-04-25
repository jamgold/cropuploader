Template.cropUploader.onRendered(function () {
  var template = this;

  this.thumbnailWidth = template.data.thumbnailWidth || undefined;
  this.thumbnailHeight = template.data.thumbnailHeight || undefined;

  if(this.thumbnailHeight == undefined && this.thumbnailWidth == undefined)
  {
    this.thumbnailHeight = 100;
    this.thumbnailWidth = 100;
  }
  // console.info(this.view.name+'.rendered',this);

  this.reader = new FileReader();
  this.preview = document.getElementById('images');

  if(!this.preview)
  {
    this.preview = document.createElement('div');
    this.preview.id = 'preview';
    document.body.appendChild(this.preview);
  }
  this.thumbnail_img = document.getElementById('thumbnail_img');
  if(!this.thumbnail_img)
  {
    // console.log('creating #thumbnail_img');
    this.thumbnail_img = document.createElement('img');
    this.thumbnail_img.id = 'thumbnail_img';
    this.thumbnail_img.classList.add('hidden');
    this.preview.appendChild(this.thumbnail_img);
  }

  this.thumbnailCanvas = document.getElementById('thumbnail_canvas');
  if(!this.thumbnailCanvas)
  {
    this.thumbnailCanvas = document.createElement('canvas');
    this.thumbnailCanvas.id = 'thumbnail_canvas';
    this.thumbnailCanvas.width = this.thumbnailWidth;
    this.thumbnailCanvas.height = this.thumbnailHeight;
    this.thumbnailCanvas.classList.add('hidden');
    this.thumbnailCanvas.classList.add('preview');
    this.preview.appendChild(this.thumbnailCanvas);
  }
  else
  {
    this.thumbnailCanvas.width = this.thumbnailWidth;
    this.thumbnailCanvas.height = this.thumbnailHeight;
  }

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
        cc.width = thumbnail_img.height;
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
  }
});
Template.cropUploader.events({
  'change input.crop-uploader-file': function(e, template) {
    var file = template.$('input[type="file"]')[0].files[0];
    // console.log(file);
    template.reader.onload = (function(aImg) { return function(e) { aImg.src = e.target.result; }; })(template.thumbnail_img);
    template.reader.readAsDataURL(file);
    $('.preview').removeClass('hidden');
  },
  'click button.crop-uploader-upload': function(e,template) {
    var file = template.$('input.crop-uploader-file');
    if(file.size()>0 && file[0].files.length > 0)
    {
      var uuid = Meteor.uuid();
      var image = file[0].files[0];
      var uploader = new Slingshot.Upload(CropUploader.name, {uuid: uuid });

      template.reader.onload = function(e) {
        //
        // e.target.result contains the image data of the original
        //
        var md5hash = MD5(e.target.result);
        var canvas = document.getElementById('thumbnail_canvas');
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
                alert (error);
              } else {
                //
                // we have uploaded the thumbnail, so now upload original
                //
                uploader.send(image, function (error, originalUrl) {
                  if (error) {
                    // Log service detailed response
                    console.error('Error uploading', uploader.xhr.response);
                    alert (error);
                  } else {
                    //
                    // add uuid and md5hash to image object
                    //
                    image.uuid = uuid;
                    image.md5hash = md5hash;
                    image.url = originalUrl;
                    //
                    // add our derivatives
                    //
                    image.derivatives = {
                      thumbnail: thumbnailUrl
                    };
                    //
                    // finally add it to the collection
                    //
                    CropUploader.images.insert( image );
                    file.val('');
                    $('.preview').addClass('hidden');
                  }
                });
              }
            });
          }, 'image/png');
        } else console.log('canvas no blob');
      };
      //
      // in order to get the MD5 for the image, we need to read it on the client
      //
      template.reader.readAsDataURL(image);
    } else alert('Please select file first');
  },
});
Template.cropUploaderImages.onRendered(function(){
  //
  this.subscribe('cropUploaderImages');
});
Template.cropUploaderImages.helpers({
  images: function() {
    return CropUploader.images.find();
  }
});
Template.cropUploaderImages.events({
  'mouseenter img':function(e,t) {
    var image = CropUploader.images.findOne(e.target.id);
    if(image) {
      $('html').css({
        background: 'url('+image.url+') no-repeat center center fixed',
        backgroundSize: 'cover'
      })
    }
  },
  'mouseleave img': function(e,t) {
    $('html').css('background','none');
  },
  'click img': function(e,t) {
    if(confirm('Delete this image?'))
    {
      CropUploader.images.remove(e.target.id);
    }
  }
});
Template.cropUploaderCropper.onCreated(function () {
  var template = this;
  CropUploader.crop.template = template;
  //
  //
  template.canvas = null;
  //
  //
  this.initCropper = function(template) {
    if(!template.view.isRendered) return;
    console.log('initCropper');
    template.imageid = template.data.imageid;
    template.original = CropUploader.images.findOne({_id: template.data.imageid});
    if(!template.original) throw new Meteor.Error(403, 'image not found');
    template.uuid = template.original.url.split('/').pop().split('.').shift();
    template.thumbnailWidth = template.data.thumbnailWidth || undefined;
    template.thumbnailHeight = template.data.thumbnailHeight || undefined;

    if(template.thumbnailHeight == undefined && template.thumbnailWidth == undefined)
    {
      template.thumbnailHeight = 100;
      template.thumbnailWidth = 100;
    }
    // console.log(template.data.exif);
    // save the cropper handle in the template
    template.cropimage = template.$(".image-container > img");
    // template.cropimage[0].onload = function(){
    //   template.cropimagedimensions = {
    //     width: template.cropimage[0].width,
    //     height: template.cropimage[0].height
    //   };
    // };
    var options = {
      aspectRatio: 1.0,
      resizable: true,
      rotatable: true,
      // checkImageOrigin: false,
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
        console.log('cropper built' );
        template.$('button.hidden').removeClass('hidden');
        //
        // this will distort getDataURL
        //
        // if(template.data.exif.Orientation && template.data.exif.Orientation == 'bottom-right')
        //   template.$('img').addClass(template.data.exif.Orientation);
      }
    };
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
  var img = new Image,
      canvas = document.createElement("canvas"),
      ctx = canvas.getContext("2d"),
      src = template.data.url; // insert image url here

  img.crossOrigin = "Anonymous";

  img.onload = function() {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage( img, 0, 0 );
      var dataUrl = canvas.toDataURL("image/png");
      // localStorage.setItem( "savedImageData", dataUrl );
      // console.log(template.cropimage);
      // console.log('savedImageData', template.$(".image-container > img"));
      template.$(".image-container > img").attr('src', dataUrl );
      template.initCropper(template);
  }
  img.src = src;
  // make sure the load event fires for cached images too
  // if ( img.complete || img.complete === undefined ) {
  //     img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
  //     img.src = src;
  //     console.log('complete');
  //     // $('img').attr('src', localStorage.getItem('savedImageData'));
  //     template.$(".image-container > img").attr('src', localStorage.getItem('savedImageData') );
  //     template.initCropper(template);
  // }
});
Template.cropUploaderCropper.onDestroyed( function () {
  var template = this;
  CropUploader.crop.template = null;
  template.cropimage = undefined;
});
