Package.describe({
  name: 'jamgold:cropuploader',
  version: '0.0.1',
  // Brief, one-line summary of the package.
  summary: 'Use slingshot to upload images to S3 and create thumbnails',
  // URL to the Git repository containing the source code for this package.
  git: 'https://github.com/jamgold/cropuploader',
  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: 'README.md'
});

Npm.depends({
  "knox": "0.9.2",
});

Package.onUse(function(api) {
  // https://github.com/blueimp/JavaScript-Canvas-to-Blob
  api.versionsFrom('METEOR@1.0');
  api.use('standard-app-packages', ['client', 'server']);
  api.use(['raix:md5','edgee:slingshot']);
  api.imply(['raix:md5','edgee:slingshot']);

  // Npm.require('knox');
  Npm.require('fibers/future');

  api.export('CropUploader');
  api.addFiles('cropuploader-common.js');
  api.addFiles('cropuploader-server.js','server');
  api.addFiles(['cropper.min.js','cropper.min.css','canvas-to-blob.js','cropuploader.css','cropuploader.html','cropuploader-client.js'],'client');
});

Package.onTest(function(api) {
  api.use('tinytest');
  api.use('jamgold:cropuploader');
  api.addFiles('cropuploader-tests.js');
});
