##Contents

This application is a experiment on how to monitor bitcoin addresses. 
The architecture of the application should not nescessarily be considered best pratice, it lacks in functionality to be really useful, and has logic flaws with regards to how a bitcoin payment should be identified.
Nevertheless, it works, seems stable ish, and demonstrates the latest ember versions as well as a couple of fun server 

The components of the system:

###Client application - the frontend

	ember.js 1.0.0
	ember-data beta 2 
	Foundation4 CSS
	
###Content server - serves the ember client
	node.js
	express.js
	
###REST server - persistance for ember-data + authentication
	node.js
	express.js
	
	Persistance: mongodb
	
###Change engine server - monitor adresses and pushes notifications to clients
	node.js 
	ws.js (websocket server)
	restler.js (rest poll client)
	

