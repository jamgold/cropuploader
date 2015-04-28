var Future = Npm.require("fibers/future");
// var Knox = Npm.require("knox");
// var assets = EJSON.parse(Assets.getText('settings.json'));

// if(!Match.test(Meteor.settings,{
//   AWSAccessKeyId: String,
//   AWSSecretAccessKey: String,
//   AWSRegion: String,
//   S3Bucket: String,
//   S3Directory: String
// })) {
//   console.log(Meteor.settings);
//   throw new Meteor.Error(500,'You must specify settings for Slingshot.S3Storage in Meteor.settings');
// }
// if(Meteor.settings.S3Directory[Meteor.settings.S3Directory.length-1]!="/")
//   Meteor.settings.S3Directory+='/';

// CropUploader.knox = Knox.createClient({
//   key: Meteor.settings.AWSAccessKeyId,
//   secret: Meteor.settings.AWSSecretAccessKey,
//   region: Meteor.settings.AWSRegion,
//   bucket: Meteor.settings.S3Bucket,
// });

// Slingshot.createDirective("cropUploader", Slingshot.S3Storage, {
//   bucket: Meteor.settings.S3Bucket,
//   //region: 
//   //AWSAccessKeyId:
//   //AWSSecretAccessKey:
//   acl: "public-read",
//   authorize: function () {
// 	// Deny uploads if user is not logged in.
// 	if (!this.userId) {
// 	  var message = "Please login before posting files";
// 	  throw new Meteor.Error("Login Required", message);
// 	}
// 	return true;
//   },
//   key: function (file, meta) {
// 	// file
// 	// {
// 	//  name: '11075296_10152631810352261_1337077077459889796_n.jpg',
// 	//  size: 17224,
// 	//  type: 'image/jpeg'
// 	// }
// 	// console.log(file, meta);
// 	var ext = file.type.split('/')[1];
// 	if(file.name.match('derivative/'))
// 	{
// 	  var d = new Date().getTime();
// 	  return Meteor.settings.S3Directory + file.name + meta.uuid +'.'+d+'.'+ext;
// 	}
// 	else
// 	{
// 	  return Meteor.settings.S3Directory+meta.uuid+'.'+ext;
// 	}
//   }
// });

Meteor.methods({
  cropUploaderS3urlBase: function() {
	return CropUploader.knox.urlBase;
  },
  cropUploaderS3contents: function(prefix) {
	var future = new Future();

	CropUploader.knox.list({prefix: prefix}, function(error, response) {
	  if(error)
	  {
		console.log(error);
		throw new Meteor.Error(500, "An error occured getting your files");
	  }
	  else 
	  {
		response.Contents.forEach(function(image){
		  image.urlBase = CropUploader.knox.urlBase;
		});
		future.return(response.Contents);
	  }
	});
	return future.wait();
  },
  cropUploaderS3Delete: function(url) {
  	// console.log(this.userId);
  	var future = new Future();
  	var uparts = url.split('//');
  	var purl = uparts.length > 2 ? uparts[2] : uparts[1]; 
	var relativeUrl = '/'+purl.split('/').slice(1).join('/');
	console.log('cropUploaderS3Delete', url, relativeUrl);
	CropUploader.knox.deleteFile( relativeUrl, function(error, res) {
		if(error) {
			console.log('cropUploaderS3Delete', error);
			future.return(true);
		}
		else future.return(true);
	});
	return future.wait()
  },
  cropUploaderConsolidate: function() {
  	  var res = Meteor.call('cropUploaderS3contents',CropUploader.directory);
  	  if(res)
  	  {
  		res.forEach(function(image){
  		  if( !image.Key.match(/\/$/) )
  		  {
  			var url = 'https://'+image.urlBase+'/'+image.Key;
  			if( !image.Key.match('derivative/') )
  			{
  			  var img = CropUploader.images.findOne({url: url});
  			  if(!img)
  			  {
  				console.log(url+' does not exist');
  				CropUploader.images.insert({
  				  url: url,
  				  relativeUrl: image.Key,
  				  urlBase: image.urlBase,
  				});
  			  }
  			  else
  			  {
  				if(img.relativeUrl == undefined)
  				{
  				  CropUploader.images.update(img._id,{$set:{
  					relativeUrl: image.Key,
  					urlBase: image.urlBase,
  				  }});
  				}
  			  }
  			} else {
  				// slingshot/derivative/thumbnail/cb276bcc-3ee3-4cd8-a03b-d4965adfca71.1429836526914.png
  				var pp = image.Key.split('/');
  				var uuid = pp.pop().split('.')[0];
  				var img = CropUploader.images.findOne({uuid: uuid});
  				if(img)
  				{
  					var type = pp.pop();
  					// console.log(type, img.derivatives);
  					var set = {};set['derivatives.'+type] = url;
  					CropUploader.images.update(img._id,{$set: set});
  				}
  				else
  				{
  					console.log(uuid+' not adding '+image.Key);
  				}
  			}
  		  }
  		});
  	  }
  }
});

Meteor.publish('cropUploaderImages', function(query) {
	query = query || {};
	return CropUploader.images.find(query);
});

CropUploader.images.allow({
	insert: function(userId, image) {
		// https://buzzledom-slingshot.s3-us-west-1.amazonaws.com/slingshot/2014-09-26.jpg
		image.userId = userId;
		image.created = new Date();
		image.urlBase = CropUploader.knox.urlBase;
		image.relativeUrl = image.url.split('//')[1].split('/').slice(1).join('/');
		// if('insert' in CropUploader._hooks && typeof CropUploader._hooks.insert == 'function')
		// 	image = CropUploader._hooks.insert(image);
		return userId && image;
	},
	update: function(userId, doc, fieldNames, modifier) {
		//
		// check if we are updating a derivative and delete the old one first
		//
		// { '$set': { 'derivatives.thumbnail': 'https://buzzledom-slingshot.s3-us-west-1.amazonaws.com/slingshot/derivative/thumbnail3f2aae7d-711f-48d1-87fe-b58611014de0.1429835432477.png' } }
		//
		var allowed = doc.userId == userId;
		var deleteUrl = null;
		if( allowed && '$set' in modifier )
		{
			for(var m in modifier['$set'])
			{
				if(m.match('derivatives.'))
				{
					var t = m.split('.')[1];
					var url = modifier['$set'][m];
					if(url != doc.derivatives[t])
					{
						deleteUrl = url;
					}
				}
			}
		}
		if(deleteUrl) {
			console.log('images.update we should be deleting', deleteUrl);
		}
		return allowed;
	},
	remove: function(userId, doc) {
		var future = new Future();
		var files = [ doc.relativeUrl ];
		if(doc.userId != userId) return false;
		//
		// build array of derivative relativeUrl
		//
		if(doc.derivatives)
		  for(var d in doc.derivatives) {
			// add short relativeUrl
			var uparts = doc.derivatives[d].split('//');
			var purl = uparts.length > 2 ? uparts[2] : uparts[1]; 
			var relativeUrl = '/'+purl.split('/').slice(1).join('/');
			files.push( relativeUrl );
		  }

		CropUploader.knox.deleteMultiple( files , function(error, res){
		  if(error)
		  {
			console.log(error);
			// throw new Meteor.Error(500, "An error occured deleting your file");
			future.return(false);
		  }
		  else 
		  {
			future.return(true);
		  }
		});

		return future.wait();
	}
});

Meteor.startup(function () {
	//
	// code to run on server at startup
	//
	// Meteor.call('cropUploaderConsolidate');
});
