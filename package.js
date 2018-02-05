Package.describe({
  name: 'jamgold:cropuploader',
  version: '0.0.4_6',
  // Brief, one-line summary of the package.
  summary: 'Use slingshot to upload images to S3 and create thumbnails; provide fengyuanchen cropper v2.3.4',
  // URL to the Git repository containing the source code for this package.
  git: 'https://github.com/jamgold/cropuploader/releases/tag/0.0.4_6',
  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: 'README.md'
});

Npm.depends({
  "knox": "0.9.2",
});

Package.onUse(function(api) {
  // https://github.com/blueimp/JavaScript-Canvas-to-Blob
  var cas = ['client', 'server'];
  api.versionsFrom('METEOR@1.0');
  // api.use('standard-app-packages', cas);
  api.use(['tracker','session','templating','handlebars'], 'client');
  api.use(['reactive-var','alanning:roles@1.2.9','matb33:collection-hooks@0.8.0','random']);
  api.use(['raix:md5@1.0.2','edgee:slingshot@0.6.2'], cas , {weak: true});
  api.imply(['raix:md5','edgee:slingshot','alanning:roles']);
  // Npm.require('knox');
  Npm.require('fibers/future');

  api.export('CropUploader');
  api.addFiles('cropuploader-common.js', cas);
  api.addFiles('cropuploader-server.js','server');
  api.addFiles(['exif.js','cropper.min.js','cropper.min.css','canvas-to-blob.js','cropuploader.css','cropuploader.html','cropuploader-client.js'],'client');
});

Package.onTest(function(api) {
  api.use('tinytest');
  api.use('jamgold:cropuploader');
  api.addFiles('cropuploader-tests.js');
});
