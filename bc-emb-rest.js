var mongo = require('mongodb');
var _ = require('underscore');

var Server = mongo.Server,
    Db = mongo.Db,
    BSON = mongo.BSONPure;

var _ = require('underscore');
var server = new Server('localhost', 27017, {auto_reconnect: true});

dbname = 'emberbc16'
db = new Db(dbname, server, {safe:false});

exports.token = {}

randstoretoken = function(){
	return Math.floor(Math.random()*(1000000-0+1)+0);
}

exports.conslog = function(msg, param){
	console.log('[ ' + msg + ' ] ' + (param || '') + '@ ' + (new Date().getTime()));
}

objid = function(thetable){
	for (var q = 0; q < thetable.dashboards.length; q++){
		thetable.dashboards[q] = new BSON.ObjectID(thetable.dashboards[q]);
	}	
	return thetable;
}

objid2 = function(thetable){
	for (var q = 0; q < thetable.length; q++){
		thetable[q] = new BSON.ObjectID(thetable[q]);
	}	
	return thetable;
}

db.open(function(err, db) {
    if(!err) {
        db.collection('user', {strict:true}, function(err, collection) {
            if (err) {
                exports.conslog("! WARNING : " + dbname + ' does not seem to be a bc database');
            }
        });
    } else {
        exports.conslog("! ERROR connecting to DB : " + dbname + '(' + err + ')');
    }
});

exports.authenticateUser = function(req, res){
	var body = req.body,
	username = body.username,
	password = body.password;
	
	db.collection('user', function(err, collection){
		collection.findOne({email: username, pass: password}, function(err, usr){
			if (usr !== null){
				var storetoken = randstoretoken()
				var storeuser = {userid: usr._id, token: storetoken}
				exports.token[usr._id] = storetoken;
				res.json({
					success: true, 
					token: storetoken,
					userid: usr._id
				});
			} else {
				res.json({
					success: false, 
					token: -1,
					userid: -1,
					message: 'Authentication error'
				});
			}
		});
	});
};

function validTokenProvided(req, res) {

  var userToken = req.headers.token; 
  var userId = req.headers.uid;
  
  if (!exports.token[userId] || userToken != exports.token[userId]) {
	exports.conslog('! AUTH FAIL');
    res.json(401, { error: 'Invalid token' });
    return false;
  }
  
  return true;
}

exports.addUser = function(req, res){

	var newuser = {
		email: req.body.user.email,
		pass: req.body.user.pass,
		dashboards: []
	}
			
	db.collection('user', function(err, usercoll) {
		usercoll.insert(newuser, {safe:true}, function(err, result) {
			res.json(200,{user:result});
		});
	});
	
}

exports.findAllUsers = function(req, res) {
	if(validTokenProvided(req, res)){
		db.collection('user', function(err, collection) {
			collection.find().toArray(function(err, items) {
				var allUsers = {users: items};
				res.json(allUsers);
			});
		});
	}
};

// exports.findFake = function(req, res) {
	// if(validTokenProvided(req, res)){
		// res.json({});
	// }
// };

exports.findOneUser = function(req, res) {
	if(validTokenProvided(req, res)){
		db.collection('user', function(err, collection) {
			collection.findOne({'_id':new BSON.ObjectID(req.params.uid)}, function(err, item) {
				var ress = {user:item}
				exports.conslog('! SEND');
				res.json(ress);
			});
		});
	}
};


exports.updateMonadr = function(req, res){
	exports.conslog("! PUT");
	
	if(validTokenProvided(req, res)){
		var updatedAddress = req.body;
		db.collection('monadr', function(err, monadrcol) {
			monadrcol.update({_id: BSON.ObjectID(req.params.id)}, {$set: {balancebtc: req.body.monadr.balancebtc}}, function(err,result2){
				monadrcol.findOne({_id: new BSON.ObjectID(req.params.id)}, function(err, result) {
					res.json({monadr:result});
				});
				
			});
		})
	}
}

exports.deleteMonadr = function(req, res){
	exports.conslog("! DELETE");
	
	if(validTokenProvided(req, res)){
		db.collection('monadr', function(err, monadrcol) {
			monadrcol.findOne({_id: new BSON.ObjectID(req.params.id)}, function(err, result) {
				monadrcol.remove({_id: new BSON.ObjectID(req.params.id)}, {safe:true}, function(err, delresult) {
					db.collection('dashboard', function(err, dashboardcol){
						dashboardcol.update( { _id: new BSON.ObjectID(result.dashboard) }, { $pull: { monadrs:  req.params.id }}, function(err,updresult){
							res.json({});
						});
					});
				});
			});
		});	
	}
}

exports.addMonadr = function(req, res){
	exports.conslog("! POST");

	if(validTokenProvided(req, res)) {
		var dashboardid = req.body.monadr.dashboard;
		var newMonadr = {	
				dashboard: dashboardid,
				title: req.body.monadr.title,
				address: req.body.monadr.address,
				duebtc: req.body.monadr.duebtc,
				balancebtc: req.body.monadr.balancebtc
		}
		
		db.collection('monadr', function(err, monadrcol) {
			monadrcol.insert(newMonadr, {safe:true}, function(err, result) {
				if (err) {
					res.json({'error':'An error has occurred ' + err});
				} else {
					var newid = result[0]._id.toString();
					db.collection('dashboard', function(err, dashboardcol) {
						dashboardcol.update({ _id: new BSON.ObjectID(dashboardid) }, { $push: {"monadrs" : newid}}, function(err3, success){
							dashboardcol.findOne({ _id: new BSON.ObjectID(dashboardid)}, function(err, result){
							});
						});
					}); 
				}
				res.json({"monadr":result[0]});
			});
		});
	}
}

exports.findMonadrs = function(req, res){

	exports.conslog("! GET");
	
	if(validTokenProvided(req, res)){
		if(req.query.ids){
			db.collection('monadr', function(err, monAdrcollection){
				monAdrcollection.find({ "_id": { $in: objid2(req.query.ids) } }).toArray(function(err, adrarr){
					res.json({monadrs: adrarr});
					
				});
			});
		} else {
			db.collection('monadr', function(err, monAdrcollection){
				monAdrcollection.find({ "address": req.query.address }).toArray(function(err, adrarr){
					res.json({monadrs: adrarr});
				});
			});
		
		}
	}
}


exports.deleteDashboard = function(req, res){
	exports.conslog("! DELETE DASH");
	
	if(validTokenProvided(req, res)){
		db.collection('dashboard', function(err, dbcoll) {
			dbcoll.findOne({_id: new BSON.ObjectID(req.params.id)}, function(err, result) {
				dbcoll.remove({_id: new BSON.ObjectID(req.params.id)}, {safe:true}, function(err, delresult) {
					db.collection('user', function(err, usercoll){
						usercoll.update( { _id: new BSON.ObjectID(result.user) }, { $pull: { dashboards: req.params.id }}, function(err,updresult){
							res.json({});
						});
					});
				});
			});
		});	
	}
}

exports.addDashboard = function(req, res){

	if(validTokenProvided(req, res)) {
	
		var newdashboard = {
			user: req.headers.uid,
			title: req.body.dashboard.title,
			monadrs: []
		}
				
		db.collection('dashboard', function(err, dbcoll) {
			dbcoll.insert(newdashboard, {safe:true}, function(err, result) {
				var newid = result[0]._id.toString();
				db.collection('user', function(err, usercol) {
					usercol.update({ _id: new BSON.ObjectID(req.headers.uid) }, { $push: {"dashboards" : newid}}, function(err3, success){
						console.log('Returning: ');
						console.log({dashboard:result});
						res.json({dashboard:result});
						
					});
				}); 
			});
		});
			
	}
	
}

exports.findUserDashboards = function(req, res) {
	exports.conslog("! GET");
		
	if(validTokenProvided(req, res) && req.headers.uid !== "undefined"){
		var foundDashboards;
		this.itemsarray = new Array();
		db.collection('user', function(err, collection) {
			collection.findOne({'_id':new BSON.ObjectID(req.headers.uid)}, function(err, userobj) {
				db.collection('dashboard', function(err, collection3){
					if (userobj !== null){
						collection3.find({"_id": {$in: objid(userobj).dashboards}}).toArray(function(err, dboards){
							foundDashboards = dboards;
							for (var i = 0; i<foundDashboards.length;i++){
								for (var p = 0; p<foundDashboards[i].monadrs.length;p++){
									db.collection('monadr', function(err, m2col) {
										m2col.findOne({'_id':new BSON.ObjectID(foundDashboards[i].monadrs[p])}, function(err, adr) {
											this.itemsarray.push(adr);
										});	
									});
								};
							}	
							res.json({dashboards : foundDashboards});
						});
					} else {
							res.json({"dashboards":[]});
					}
				});
			});
		});
	} else {
		res.json(401,{});
	}
};




