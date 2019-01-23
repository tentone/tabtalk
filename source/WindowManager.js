"use strict";

import {EventManager} from "./EventManager.js";
import {WindowSession} from "./WindowSession.js";
import {WindowMessage} from "./WindowMessage.js";

/**
 * Message utils takes care of messaging between multiple windows. Messages can be transfered direcly or forwarded between windows.
 *
 * Is responsible for keeping track of all sessions, handles message reception, message forwarding and message sending.
 *
 * When a window is open it cannot be acessed we need to wait for the ready message.
 * 
 * @class WindowManager
 * @param {String} type Type of this window.
 */
function WindowManager(type)
{
	var self = this;

	/** 
	 * Type of this window manager object.
	 *
	 * @attribute type
	 * @type {String}
	 */
	this.type = type;

	/**
	 * UUID of this window manager.
	 *
	 * Used to identify this window on communication with another windows.
	 *
	 * @attribute uuid
	 * @type {String}
	 */
	this.uuid = WindowManager.generateUUID();

	/**
	 * Map of known sessions.
	 *
	 * Indexed by the UUID of the session.
	 *
	 * @attribute sessions
	 * @type {Object}
	 */
	this.sessions = {};

	/**
	 * List of sessions in waiting state.
	 *
	 * These still havent reached the READY state.
	 *
	 * @attribute waitingSessions
	 * @type {Array}
	 */
	this.waitingSessions = [];

	/**
	 * On broadcast message callback, receives data and authentication as parameters.
	 *
	 * Called when a broadcast message arrives, onBroadcastMessage(data, authentication).
	 *
	 * @attribute onBroadcastMessage
	 * @type {Function}
	 */
	this.onBroadcastMessage = null;

	/**
	 * Event manager containing the message handling events for this manager.
	 *
	 * @attribute manager
	 * @type {EventManager}
	 */
	this.manager = new EventManager();
	this.manager.add(window, "message", function(event)
	{
		//console.log("TabTalk: Window message event fired.", event);

		var message = event.data;

		//Messages that need to be redirected
		if(message.destinationUUID !== undefined && message.destinationUUID !== self.uuid)
		{
			console.warn("TabTalk: Destination UUID diferent from self, destination is " + message.destinationUUID);

			var session = self.sessions[message.destinationUUID];

			if(session !== undefined)
			{
				message.hops.push(self.uuid);
				session.send(message);
				console.log("TabTalk: Redirect message to destination.", session, message);
			}
			else
			{
				console.warn("TabTalk: Unknown destination, cannot redirect message.");
			}

			return;
		}
		//Messages to be processed
		else
		{
			//Session closed
			if(message.action === WindowMessage.CLOSED)
			{
				var session = self.sessions[message.originUUID];

				if(session !== undefined)
				{
					if(session.onClose != null)
					{
						session.onClose();
					}

					delete self.sessions[message.originUUID];
				}
				else
				{
					console.warn("TabTalk: Unknown closed origin session.")
				}
			}
			//Lookup
			else if(message.action === WindowMessage.LOOKUP)
			{
				console.log("TabTalk: WindowManager lookup request received from " + message.originType + ".", message);

				var found = false;
				var response;

				for(var i in self.sessions)
				{
					var session = self.sessions[i];

					if(session.type === message.destinationType)
					{
						var response = new WindowMessage(0, WindowMessage.LOOKUP_FOUND, self.type, self.uuid, undefined, undefined,
						{
							uuid:session.uuid,
							type:session.type
						});
						found = true;
						break;
					}
					else
					{
						//TODO <BROADCAST LOOKUP MESSAGE>
					}
				}

				if(found === false)
				{
					response = new WindowMessage(0, WindowMessage.LOOKUP_NOT_FOUND, self.type, self.uuid);
				}

				var session = self.sessions[message.originUUID];
				if(session !== undefined)
				{
					session.send(response);
					console.log("TabTalk: Response to lookup request sent.", response);
				}
				else
				{
					console.warn("TabTalk: Unknown lookup origin session.");
				}
			}
			//Connect message
			else if(message.action === WindowMessage.CONNECT)
			{
				var gatewayUUID = message.hops.pop();
				var gateway = self.sessions[gatewayUUID];

				if(gateway !== undefined)
				{
					var session = new WindowSession(self);
					session.uuid = message.originUUID;
					session.type = message.originType;
					session.gateway = gateway;
					session.waitReady();
					session.acknowledge();
					console.warn("TabTalk: Connect message received, creating a new session.", message, session);
				}
				else
				{
					console.error("TabTalk: Connect message received, but the gateway is unknown.", message);
				}
			}
			//Broadcast
			else if(message.action === WindowMessage.BROADCAST)
			{
				console.log("TabTalk: WindowManager broadcast message received " + message.originType + ".", message);

				if(self.onBroadcastMessage !== null)
				{
					self.onBroadcastMessage(message.data, message.authentication);
				}

				//TODO <FIX BROADCAST LOOP>

				for(var i in self.sessions)
				{
					var session = self.sessions[i];

					if(session.uuid !== message.originUUID)
					{
						session.send(message);

						if(session.onBroadcastMessage !== null)
						{
							session.onBroadcastMessage(message.data, message.authentication);
						}
					}
				}
			}
			//Messages
			else if(message.action === WindowMessage.MESSAGE)
			{
				console.log("TabTalk: WindowManager message received " + message.originType + ".", message);

				var session = self.sessions[message.originUUID];
				if(session !== undefined)
				{
					if(session.onMessage !== null)
					{
						session.onMessage(message.data, message.authentication);
					}
				}
				else
				{
					console.warn("TabTalk: Unknown origin session.");
				}
			}
			else
			{
				console.warn("TabTalk: Unknown message type.");
			}
		}
	});

	this.manager.add(window, "beforeunload", function(event)
	{
		for(var i in self.sessions)
		{
			self.sessions[i].close();
		}
	});

	this.manager.create();

	this.checkOpener();
}

/**
 * Log to the console a list of all known sessions
 *
 * @method logSessions
 */
WindowManager.prototype.logSessions = function()
{
	console.log("TabTalk: List of known sessions:");
	for(var i in this.sessions)
	{
		var session = this.sessions[i];

		console.log("     " + session.uuid + " | " + session.type + " -> " + (session.gateway === null ? "*" : session.gateway.uuid));
	}
};

/**
 * Broadcast a message to all available sessions.
 *
 * The message will be passed further on.
 *
 * @method broadcast
 * @param {WindowMessage} data Data to be broadcasted.
 * @param {String} authentication Authentication information.
 */
WindowManager.prototype.broadcast = function(data, authentication)
{
	var message = new WindowMessage(0, WindowMessage.BROADCAST, this.manager.type, this.manager.uuid, undefined, undefined, data, authentication);

	for(var i in this.sessions)
	{
		this.sessions[i].send(message);
	}
};

/**
 * Send an acknowledge message.
 *
 * Used to send a signal indicating the parent window that it is ready to receive data.
 *
 * @method checkOpener
 * @return {WindowSession} Session fo the opener window, null if the window was not opened.
 */
WindowManager.prototype.checkOpener = function()
{
	if(this.wasOpened())
	{
		var session = new WindowSession(this);
		session.window = window.opener;
		session.acknowledge();
		session.waitReady();
		return session;
	}

	return null;
};

/**
 * Create a new session with a new window from URL and type.
 *
 * First needs to search for a window of the same type in the known sessions.
 *
 * @method openSession
 * @param {String} url URL of the window.
 * @param {String} type Type of the window to open (Optional).
 * @return {WindowSession} Session createed to open a new window.
 */
WindowManager.prototype.openSession = function(url, type)
{
	//Search in the current sessions
	for(var i in this.sessions)
	{
		var session = this.sessions[i];
		if(session.type === type)
		{
			console.warn("TabTalk: A session of the type " + type + " already exists.");
			return session;
		}
	}

	var session = new WindowSession(this);
	session.type = type;

	//Lookup the session
	if(type !== undefined)
	{
		this.lookup(type, function(gateway, uuid, type)
		{
			//Not found
			if(gateway === null)
			{
				if(url !== null)
				{				
					session.url = url;
					session.window = window.open(url);
					session.waitReady();
				}
			}
			//Found
			else
			{
				session.gateway = gateway;
				session.uuid = uuid;
				session.type = type;
				session.waitReady();
				session.connect();
			}
		});
	}

	return session;
};

/**
 * Lookup for a window type.
 *
 * @method lookup
 * @param {String} type Type of the window to look for.
 * @param {String} onFinish Receives the gateway session, found uuid and type as parameters onFinish(session, uuid, type), if null no window of the type was found.
 */
WindowManager.prototype.lookup = function(type, onFinish)
{
	var message = new WindowMessage(0, WindowMessage.LOOKUP, this.type, this.uuid, type, undefined);
	var sent = 0, received = 0, found = false;

	for(var i in this.sessions)
	{
		console.log("TabTalk: Send lookup message to " + i + ".", message);
		this.sessions[i].send(message);
		sent++;
	}

	if(sent > 0)
	{
		var self = this;
		var manager = new EventManager();
		manager.add(window, "message", function(event)
		{
			var data = event.data;
			if(data.action === WindowMessage.LOOKUP_FOUND)
			{

				if(found === false)
				{
					var session = self.sessions[data.originUUID];
					if(session !== undefined)
					{
						found = true;
						onFinish(session, data.data.uuid, data.data.type);
					}
				}
				
				console.log("TabTalk: Received lookup FOUND message from " + data.originUUID + ".", data.data);
				received++;
			}
			else if(data.action === WindowMessage.LOOKUP_NOT_FOUND)
			{
				console.log("TabTalk: Received lookup NOT FOUND message from " + data.originUUID + ".");
				received++;
			}

			if(sent === received)
			{
				manager.destroy();

				if(found === false)
				{
					onFinish(null);
				}
			}
		});
		manager.create();
	}
	else
	{
		console.log("TabTalk: No session available to run lookup.");
		onFinish(null);
	}
};

/**
 * Check if this window was opened by another one.
 *
 * @method wasOpened
 * @return {Boolean} True if the window was opened by another window, false otherwise.
 */
WindowManager.prototype.wasOpened = function()
{
	return window.opener !== null;
};

/**
 * Dispose the window manager.
 *
 * Should be called when its not used anymore. Destroy all the window events created by the manager.
 *
 * @method dispose
 */
WindowManager.prototype.dispose = function()
{
	for(var i in this.sessions)
	{
		this.sessions[i].close();
	}

	this.manager.destroy();
};

/**
 * Generate a UUID used to indetify the window manager.
 *
 * .toUpperCase() here flattens concatenated strings to save heap memory space.
 *
 * http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript/21963136#21963136
 *
 * @method generateUUID
 * @return {String} UUID generated.
 */
WindowManager.generateUUID = function()
{
	var lut = [];
	for(var i = 0; i < 256; i ++)
	{
		lut[i] = (i < 16 ? "0" : "") + (i).toString(16);
	}

	return function generateUUID()
	{
		var d0 = Math.random() * 0xffffffff | 0;
		var d1 = Math.random() * 0xffffffff | 0;
		var d2 = Math.random() * 0xffffffff | 0;
		var d3 = Math.random() * 0xffffffff | 0;
		var uuid = lut[ d0 & 0xff ] + lut[ d0 >> 8 & 0xff ] + lut[ d0 >> 16 & 0xff ] + lut[ d0 >> 24 & 0xff ] + "-" +
			lut[ d1 & 0xff ] + lut[ d1 >> 8 & 0xff ] + "-" + lut[ d1 >> 16 & 0x0f | 0x40 ] + lut[ d1 >> 24 & 0xff ] + "-" +
			lut[ d2 & 0x3f | 0x80 ] + lut[ d2 >> 8 & 0xff ] + "-" + lut[ d2 >> 16 & 0xff ] + lut[ d2 >> 24 & 0xff ] +
			lut[ d3 & 0xff ] + lut[ d3 >> 8 & 0xff ] + lut[ d3 >> 16 & 0xff ] + lut[ d3 >> 24 & 0xff ];

		return uuid.toUpperCase();
	};
}();

export {WindowManager};