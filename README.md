##Intro

This application is a experiment on how to monitor bitcoin addresses. 
The architecture of the application should not nescessarily be considered best pratice, it lacks in functionality to be really useful, and has logic flaws with regards to how a bitcoin payment should be identified. Some approaches may indeed be suboptimal or insecure.
Nevertheless, it works, seems stable ish, and demonstrates the latest ember versions as well as a couple of fun server techniques.

#### TODO #1 : Passwords are not hashed ! 

The application functions as follows:

Client adds a bitcoin address to monitor. The address is pushed to the server in a socket subscription message and registered in the address pool.
The server periodicly polls the blockchain.info REST api for address balances, and upon any changes, pushes the new balance back to the client socket. 
(All addresses added by any client gets pooled, and polled in a single rest call to blockchain.info)
All clients subscribing to the address, which's address balance has been identified to have changed, receives the updated balance in a push message from the server.
Upon receiving the server push, the updated balance is pushed back into the peristant storage through the ember-data models, and into the mongodb instance.

####Why such an elaborate setup to monitor a few bitcoin addresses?

Learning, studying scalability, wanted to try out both REST and socket modules.

####Why didn't i just use the blockchain.info Websocket API, instead of polling the REST api ?

At the time i began to develop this, the blockchain.info socket API *seemed* unstable. I might have made mistakes, but it dropped the subscriptions very fast and in some cases responded extremely slowly.

####Why not just manage the websocket subscriptions on the client, - thats what they are for, and very cheap to utilize

Learning, studying scalability again. Just one single socket on the client to keep, and one single rest call towards the api seemed neat.

""The components of the system:

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
	

