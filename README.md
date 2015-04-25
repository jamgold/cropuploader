# Package to Upload and Crop images

The purpose of this package is to provide an easy image upload that automatically creates a cropped derivative. Additionally the package provides a template to interactively crop an image to add/replace the derivative.

## requires meteor-slingshot and currently only supports Slingshot.S3Storage

### I never tested without anonymous upload, so accounts-password is also required as a minimum

Any app using this package must setup Slingshot and then call the `CropUploader.init` method with the name of the directive, and the subdirectory in the S3 bucket. In the example it is assumed that Meteor.settings provides the necessary parameters for AWS S3.

The package provides it's own collection to manage the uploaded images and their derivatives.

Here is a quick example

```
MySlingShotName = 'simpleUploader';
// standard Slingshot
Slingshot.fileRestrictions(MySlingShotName, {
  allowedFileTypes: ["image/png", "image/jpeg", "image/gif"],
  maxSize: 10 * 1024 * 1024 // 10 MB (use null for unlimited)
});

if(Meteor.isServer)
{
    // standard Slingshot
    Slingshot.createDirective(MySlingShotName, Slingshot.S3Storage, {
      bucket: Meteor.settings.S3Bucket,
      acl: "public-read",
      authorize: function () {
        // Deny uploads if user is not logged in.
        if (!this.userId) {
          var message = "Please login before posting files";
          throw new Meteor.Error("Login Required", message);
        }
        return true;
      },
      // you must provide a key methods, but CropUploader.init will override it
      key: function(file) {  }
    });
    // call CropUloader.init
    CropUploader.init(MySlingShotName, Meteor.settings.S3Directory);
}
if(Meteor.isClient)
{
    var directory = ''; // same as Meteor.settings.S3Directory
    CropUploader.init(MySlingShotName, directory);

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
}
```

There are two easy templates that can be used. The first is the uploader itself, which just renders a File input and a button. You can pass in the size of the derivative thumbnail that should be generated. The package will take care of the events for the cropUploader template. As soon as a file is selected it will generate a preview in canvas#thumbnail_canvas. If that DOMelement does not exist, it will be created

```
<template name="images">
    {{>cropUploader thumbnailWidth=200 thumbnailHeight=200}}

    <div class="images" id="images">
        {{#if Template.subscriptionsReady}}
          {{#each images}}
            <div class="thumbnail">
                {{#if derivatives.thumbnail}}
                <img src="{{derivatives.thumbnail}}" id="{{_id}}">
                {{else}}
                <img src="{{url}}" width="100" height="100" id="{{_id}}">
                {{/if}}
                <h6 class="id">{{_id}}</h6>
            </div>
          {{/each}}
        {{/if}}
        <div class="preview thumbnail">
              <canvas id="thumbnail_canvas"></canvas>
              <h6 class="id">Preview</h6>
        </div>
    </div>
</template>
```

cropUploader will simply render 

```
    <input type="file" class="crop-uploader-file"> <button class="crop-uploader-upload">Upload</button>
```

Here is a typical document from the CropUploader.images collection

```
> CropUploader.images.findOne()
{ _id: 'BQG9hQcobXw8EKT89',
  uuid: '0e0f77da-2d64-4f56-92e5-3ebccb554389',
  md5hash: '6084f1610eea5603d1278797968959ce',
  url: 'https:<aws url>/0e0f77da-2d64-4f56-92e5-3ebccb554389.png',
  derivatives: {
    thumbnail: 'https://<aws url>/derivative/thumbnail/0e0f77da-2d64-4f56-92e5-3ebccb554389.1429986799459.png'
    },
  name: 'yeah-if-you-could-go-ahead-and-come-in-on-saturday-to-groom-this-code-that-would-be-great-83405.png',
  lastModifiedDate: Sat Apr 25 2015 10:48:25 GMT-0700 (PDT),
  size: 423809,
  type: 'image/png',
  userId: 'eLiG6RSe4QFFS3oFq',
  created: Sat Apr 25 2015 11:33:20 GMT-0700 (PDT),
  urlBase: '<aws url>',
  relativeUrl: '<aws dir>/0e0f77da-2d64-4f56-92e5-3ebccb554389.png'
}
```

The second template provided is called cropUploaderCropper and it requires the collection id of the image to be cropped and the url to the image. It again takes a width and height to determine the size of the resulting image. This template will render the awesome [cropper](https://github.com/fengyuanchen/cropper)

```
<template name="cropper">
    {{#if Template.subscriptionsReady}}
        {{>cropUploaderCropper imageid=imageid url=url thumbnailWidth=200 thumbnailHeight=200}}
        <div class="buttons">
            <button class="btn rotate">Rotate</button>
            {{#if currentUser}}
            <button class="btn btn-success save" imageid="{{imageid}}">Save</button>
            <button class="btn btn-danger delete" imageid="{{imageid}}">Delete</button>
            {{/if}}
        </div>
    {{else}}
        Loading
    {{/if}}
</template>
```

All you need to take care of are the event actions, I used a simple Session var to store the desired image id.

```
Template.cropper.onCreated(function(){
  this.subscribe('cropUploaderImages', {_id: Session.get('imageid')});
});
Template.cropper.helpers({
  imageid: function() {
    return Session.get('imageid');
  },
  url: function() {
    return CropUploader.images.findOne(Session.get('imageid')).url;
  }
});
Template.cropper.events({
  'click button.delete': function(e,t) {
    if(confirm('Delete this image?'))
    {
      var imageid = t.$(e.target).attr('imageid');
      CropUploader.images.remove(imageid);
      // change route away from the image since it no longer exists
    }
  },
  'click button.save': function(e,t) {
    // provide the name of the derivative, thumbnail is the default
    CropUploader.crop.save('thumbnail');
  },
  'click button.rotate': function(e,t) {
    CropUploader.crop.rotate();
  }
});
```