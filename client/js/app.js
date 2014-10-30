
//--- [App] ---------------------------------

App = Ember.Application.create({ 
	LOG_TRANSITIONS: true,
	wsocketoff: false,
	wsocket: "",
	wsocketTimer: "",
	wsocketUrl: "ws://orz.dk:3010",
	wsclientToken : randomFromInterval(0,10000000),
	wsocketretries: 0,
	
	wsocketSend : function(arr){
		var message = '{"clienttoken":' + this.wsclientToken + ', "adrs":' + JSON.stringify(arr) + '}';
		console.log('[WS READYSTATE] ' + this.wsocket.readyState);
		if (this.wsocket.readyState == 1) {
			console.log('[SENDING MSG TO WS] ' + message);
			this.wsocket.send(message);
		} 
	},

	ready: function(){
	
		$(document).ajaxError(function(event, request, settings) {
			controller = App.__container__.lookup('controller:application')
			controller.transitionToRoute("noauth", {id:request.status});
		});
		
		Ember.$.ajaxPrefilter(function(options, originalOptions, jqXHR) {
			controller = App.__container__.lookup('controller:login')
			jqXHR.setRequestHeader('token', controller.get('token'));
			jqXHR.setRequestHeader('uid', controller.get('currentUserId'));
		});

	}
});

App.ApplicationAdapter = DS.RESTAdapter.extend({
  host: 'http://orz.dk:3003'
});

App.ApplicationSerializer = DS.RESTSerializer.extend({
	primaryKey: '_id',
})

App.Router.map(function(){ 

  this.resource("noauth", {path:"/noauth/:id"});
  this.resource("login", {path:"/login"});
  this.resource("signup", {path:"/signup"});
 
  this.resource("users", {path:"/users"}, function(){
	this.resource("user", {path: "/:user_id"}, function(){
		this.resource("dashboards", {path: "/dashboards"}, function(){
			this.route("new", {path:"/new"});
			this.resource("dashboard", {path: "/:dashboard_id"});
		});
	});
  });
  
});


//--- [Routes] ---------------------------------

App.DashboardsRoute = Ember.Route.extend({
	model : function(params){
		return this.store.find("dashboard");	
	}
});

App.DashboardRoute = Ember.Route.extend({
	setupController: function(controller, model){
		this._super(controller,model);
		controller.set('oneSelected',true);
	}
});

App.LoginRoute = Ember.Route.extend({
	setupController: function(controller, context) {
		controller.reset();
	}
});


//--- [Controllers] ---------------------------------

App.ApplicationController = Ember.Controller.extend({
	
	needs:["login", "dashboard", "dashboards", "user", "monadr"],
	
	loggedInBinding: "controllers.login.loggedIn",
	tokenBinding: "controllers.login.token",
	currentUserEmailBinding: "controllers.login.currentUserEmail",
	currentUserIdBinding: "controllers.login.currentUserId",
	currentDashBinding: "controllers.dashboard.title",
	currentDashIdBinding: "controllers.dashboard",
	currentDashboardsBinding: "controllers.dashboards",
	currentListCountBinding: "controllers.dashboard.monadrs.length",
	currentDashCountBinding: "controllers.dashboards.length",
	oneSelectedBinding: "controllers.dashboard.oneSelected",

	clientToken: function(){
		return App.get("wsclientToken");
	}.property("wsclientToken"),		
	
	currentPathDidChange: function() {
		App.set("currentPath", this.get("currentPath"));
    }.observes("currentPath"),
		
	actions:{
		linktoLogin: function(param){
			this.transitionToRoute("login");
		},		
		linktoLogout: function(param){
	
			$('body').html('<br>'.repeat(50));
			
			var popup = '<div class="buutton.b-close"><img src="images/ajax-loader.gif"></div>';
			
			$(popup).bPopup({
				easing: 'easeInBack',
				speed: 500,
				transition: 'slideDown',
				modalColor: 'black'
			})	
			
			setTimeout(function(){
				App.reset();
				
				setTimeout(function(){window.location.reload(true);},1050);
			}, 1100);
		},		
		linktoSignup: function(param){
			this.transitionToRoute("signup");
		},
		
		linktoCreateDashboard: function(param){
			this.transitionToRoute("dashboards.new");
		},
		
		removedashboard: function(dashboard) {

			dashboard.one("didDelete", this, function () {
				that=this;
				if(this.get("controllers.dashboards").objectAt(0)){
					this.transitionToRoute("dashboard", this.get("controllers.dashboards").objectAt(0));
				} else {
					this.set('oneSelected', null);
					this.transitionToRoute("dashboards.index");
				}
			});
			
			this.store.find("user", {id: this.currentUserId}).then(
				function(user){
					dashboard.deleteRecord();
					dashboard.save();
					user.get("dashboards.content").removeObject(dashboard);
				}
			);
		}
		
	}
});

App.LoginController = Ember.Controller.extend({
	
	tokenChanged: function() {
		localStorage.token = this.get('token');
	}.observes('token'),
	
	reset: function() {
		this.setProperties({
			errorMessage: "",
			currentUserEmail: "",
			currentUserId: "",
			token: "",
			loggedIn: false,
			lt: 'You are already logged in'
		});
	},

	actions: {
	
		udfyld: function(){
			this.setProperties({
			  username: "",
			  password: "",
			});
		},
  
		login: function() {
			var self = this, data = this.getProperties('username', 'password');
			this.set('errorMessage', null);
			$.post('http://orz.dk:3003/auth.json', data).then(function(response) {
				self.set('errorMessage', response.message);
				if (response.success) {
					self.set('token', response.token);
					self.set('loggedIn', true);
					self.set('currentUserEmail', data.username);
					self.set('currentUserId', response.userid);
					self.set('lt','');
					self.transitionToRoute("dashboards", {id: response.userid});
					
				} else {
					self.set('token', -1);
					self.set('loggedIn', false);
				}
			});
		}
		
	}
});

App.DashboardsController = Ember.ArrayController.extend({
});

App.DashboardsNewController = Ember.ArrayController.extend({
needs:['dashboards','user', 'login'],

actions: {

    createDash: function (q) {
		var that = this;
		var title = this.get('newTitle');
		this.set('newTitle', '');	
		
		if (!title.trim()) { return; }
		
		var dash = this.store.createRecord('dashboard', {
			title: title,
			monadrs: []
		});
		
		dash.save();
		this.get('controllers.dashboards.content').pushObject(dash);
	}
  }
  
});

App.DashboardController = Ember.ObjectController.extend({
	needs:['input'],
	oneSelected: null,
	content:[],
	f: function(){
		Ember.run.next(this, function(){
			App.wsocketSend(this.get('controllers.input').activeAdrArr());
		});
	}.observes(this.id),
		
	actions: {
		removeItem: function(monadr) {
			that=this;
			this.get('monadrs.content').removeObject(monadr);
			monadr.deleteRecord();
			monadr.save().then(
				function(){
					console.log('[OBJ DELETED+SAVED]');
					App.wsocketSend(that.get('controllers.input').activeAdrArr());
				},
				function(err){
					console.log('[ERR SAVING] ' + err);
				}
			);
		}
	}
	
});

App.InputController = Ember.ArrayController.extend({
	needs: ['dashboard'],
	
	init: function(){
		var that=this;
		if (!App.get('wsocketoff'))
			App.set('wsocketTimer', setInterval(function(){that.refreshSocket()}, 8000));	
	},
	
	activeAdrArr: function(){
		var c = {}
		if (this.get('controllers.dashboard.content.monadrs')){
			this.get('controllers.dashboard.content.monadrs').toArray().forEach(function(item){
				c[item.get('address').toString()] = {};
			});
		}
		return c;		
	},
	
	refreshSocket: function(){
		var that = this;
		console.log('[ ? CHECK READY: ' + App.get('wsocket').readyState + ' ]');
		
		if (App.get('wsocket').readyState === undefined || App.get('wsocket').readyState > 1) {
			console.log('[ ! WS CREATE SOCKET ]');
			
			App.set('wsocket', new WebSocket(App.get('wsocketUrl')));
			
			App.get('wsocket').onmessage = function(evt) { 
				console.log('[WS RECEIVE]');
				console.log(evt.data);
				
				that.store.find('monadr', {'address': JSON.parse(evt.data).adr}).then(function(adrs) {
				  adrs.forEach(function(adr) {
					adr.set('balancebtc', JSON.parse(evt.data).newbalance);
				  });

				  return Ember.RSVP.all(adrs.invoke('save'));
				}).then(function(adrs) {
				   console.log('OBJ SAVED SUCCESSFULLY. HAT');
				   console.log(adrs);
				});
				
			};
						
			App.get('wsocket').onopen = function(evt) { 
				console.log('[WS OPEN+INITSEND]');
				App.wsocketSend(that.activeAdrArr());
			};
			
			App.get('wsocket').onclose = function(evt) { 
				console.log('[WS CLOSE]');
			};
			
			App.get('wsocket').onerror = function(evt) { 
				App.set('wsocketretries', App.get('wsocketretries') + 1);
				console.log('[WS ERR] ' + App.get('wsocketretries')); 
				if (App.get('wsocketretries') > 3) {
					clearInterval(App.get('wsocketTimer'));
					console.log('[ ! WS CANCEL]');
				}
			};
		}	
	},
	
	actions: {
		submitForm: function() {
			var that = this;
			
			var newRecord = {
				dashboard: this.get('controllers.dashboard.model'),
				address: this.get('address'),
				title: this.get('title'),
				duebtc: this.get('duebtc'),
				balancebtc:0
			}
			
			var monadrcontent = that.get('controllers.dashboard.content.monadrs.content');
			if (monadrcontent == null) that.set('controllers.dashboard.content.monadrs.content',[]);

			var monadr = this.store.createRecord('monadr', newRecord);
		    that.get('controllers.dashboard.content.monadrs.content').pushObject(monadr);
		   
			monadr.save().then(
				function(){
					console.log('[SAVE MONADR]');

					that.set('address','');
					that.set('title','');
					that.set('duebtc','');
					
					App.wsocketSend(that.activeAdrArr());
					
				},
				function(err){
					console.log('[ERR] ' + err);
				}
			);
		}
	}
	
});

App.SignupController = Ember.ArrayController.extend({
needs:['login'],
actions: {
 
    createUser: function () {
	  var that = this;
      var email = this.get('newEmail');
	  var pass = this.get('newPass');
      
	  if (!email.trim() || !pass.trim()) { return; }

      var user = this.store.createRecord('user',{
        email: email,
        pass: pass,
        dashboards: []
      });
	  
	  user.one('didCreate', function(g){
		that.transitionToRoute("login");
	  });

      this.set('newEmail', '');
      this.set('newPass', '');

      user.save().then(
			function(result){},
			function(err){
				console.log(err);
			}
	   );
    }
  }
  
});


//--- [Views] ---------------------------------------

Ember.Handlebars.helper("color", function(due, act) {
  if (act===0){
		return new Handlebars.SafeString("<img style='margin-left:17px' src='images/sl_yellow.png' border='0'>");
	}else {
		if (due>act)
			return new Handlebars.SafeString("<img style='margin-left:17px' src='images/sl_red.png' border='0'>");
		else
			return new Handlebars.SafeString("<img style='margin-left:17px' src='images/sl_green.png' border='0'>");
	}
});

App.ApplicationView = Ember.View.extend({
    classNames: ["ember-app"]
})

App.balancebtcfield = Ember.TextField.extend({ 
    valueDidChange: function() {
        if(this.get('state') === 'inDOM') {
			if (this.get('value') > 0){
				this.$().animateHighlight();
			}
        }
    }.observes('value')

});
	
App.itemRowView = Ember.View.extend({
	tagname: 'div',
	didInsertElement: function(d) {
		that = this;
		this.$().hide().slideDown(function(){});
	}

});


// --- [Models] ---------------------------------------

App.User = DS.Model.extend({
	primaryKey: '_id',
	email: DS.attr('string'),
	pass: DS.attr('string'),
	dashboards: DS.hasMany('dashboard', {async:true})
});

App.Dashboard = DS.Model.extend({
	primaryKey: '_id',
	user: DS.belongsTo('user'),
	title: DS.attr('string'),
	monadrs: DS.hasMany('monadr', {async:true})
});

App.Monadr = DS.Model.extend({
	primaryKey: '_id',
	dashboard: DS.belongsTo('dashboard'),
	title: DS.attr('string'),
	address: DS.attr('string'),
	duebtc: DS.attr('number'),
	balancebtc: DS.attr('number')
});



