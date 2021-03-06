"use strict";

/**
 * Message object sent between windows.
 *
 * Contains booth window identification useful for message forwarding between windows and user authentication data.
 *
 * @class
 */
function WindowMessage(number, action, originType, originUUID, destinationType, destinationUUID, data, authentication)
{
	/**
	 * Message number in the context of messages exchanged between the windows.
	 *
	 * @type {Number}
	 */
	this.number = number;

	/**
	 * The action category of this message.
	 *
	 * Obligatory message field.
	 *
	 * @type {Number}
	 */
	this.action = action;

	 /**
	 * Type of the window that sent the message.
	 *
	 * Obligatory message field.
	 *
	 * (e.g. "3D", "Main", etc)
	 *
	 * @type {String}
	 */
	this.originType = originType;

	/**
	 * UUID to identify the window that sent the message.
	 *
	 * Obligatory message field.
	 *
	 * @type {String}
	 */
	this.originUUID = originUUID;

	/**
	 * Type of the destination.
	 *
	 * Optional message field.
	 *
	 * @type {String}
	 */
	if(destinationType !== undefined)
	{
		this.destinationType = destinationType;
	}

	/**
	 * UUID to identify the destination of the message.
	 *
	 * Optional message field.
	 *
	 * @type {String}
	 */
	if(destinationUUID !== undefined)
	{
		this.destinationUUID = destinationUUID;
	}

	/**
	 * Payload of the message (the actual content of the message).
	 *
	 * Beware that object refereces are not accessible across windows.
	 *
	 * Optional message field.
	 *
	 * @type {Object}
	 */
	if(data !== undefined)
	{
		this.data = data;
	}

	/**
	 * Token of the user for authentication.
	 *
	 * Optional message field.
	 *
	 * @type {String}
	 */
	if(authentication !== undefined)
	{
		this.authentication = authentication;
	}

	/**
	 * Hops of this message until it reaches its destination.
	 *
	 * Each window where this message passes should push its UUID to this list.
	 *
	 * e.g [UUID1, UUID2, UUID3], UUID3 is the uuid of the last sessions before destination, booth origin and destination are not included in the hop list.
	 * 
	 * @type {Array}
	 */
	this.hops = [];
}

/**
 * Ready message exchanged before starting comunication.
 *
 * {
 *		type: READY,
 *		originUUID: ...,
 *		originType: ...
 * }
 *
 * @static
 * @attribute {Number}
 */
WindowMessage.READY = 0;

/**
 * Closed message is used to indicate that the comunication was terminated.
 *
 * {
 *		type: CLOSED,
 *		originUUID: ...,
 *		originType: ...
 * }
 *
 * @static
 * @attribute {Number}
 */
WindowMessage.CLOSED = 1;

/**
 * Message to lookup for a window type in the neighbor session.
 *
 * {
 *		type: LOOKUP,
 *		originUUID: ...,
 *		originType: ...,
 *		destinationType: ...
 * }
 *
 * @static
 * @attribute {Number}
 */
WindowMessage.LOOKUP = 2;

/**
 * Regular message exchanged between the windows.
 *
 * {
 *		type: LOOKUP,
 *		originUUID: ...,
 *		originType: ...,
 *		destinationType: ...,
 *		destinationUUID: ...,
 *		data(?): ...,
 *		authentication(?): ...
 * }
 *
 * @static
 * @attribute {Number}
 */
WindowMessage.MESSAGE = 3;

/**
 * Broadcast message.
 *
 * {
 *		type: BROADCAST,
 *		originUUID: ...,
 *		originType: ...,
 *		destinationUUID: "*",
 *		hops: [UUID1, UUID2, ...], //Each hop adds its UUID to the list
 *		data(?): ...,
 *		authentication(?): ...
 * }
 *
 * @static
 * @attribute {Number}
 */
WindowMessage.BROADCAST = 4;

/**
 * Lookup response for when a window was found.
 *
 * {
 *		type: LOOKUP_FOUND,
 *		originUUID: ...,
 *		originType: ...,
 *		data:
 *		{
 *			uuid: ..., //Of the requested session
 *			type: ... 
 *		}
 * }
 *
 * @static
 * @attribute {Number}
 */
WindowMessage.LOOKUP_FOUND = 5;

/**
 * Message responde for when a window is not found.
 *
 * {
 *		type: LOOKUP_NOT_FOUND,
 *		originUUID: ...,
 *		originType: ...
 * }
 *
 * @static
 * @attribute {Number}
 */
WindowMessage.LOOKUP_NOT_FOUND = 6;

/**
 * Message used after obtaining a positive lookup respose to connect to the remote window trough the middle layers.
 *
 * After the connect message reaches the destination the window should send a READY message.
 *
 * {
 *		type: CONNECT,
 *		originUUID: ...,
 *		originType: ...,
 *		destinationType: ...,
 *		destinationUUID: ...,
 *		hops: [UUID1, UUID2, ...] //Each hop adds its UUID to the list
 * }
 *
 * @static
 * @attribute {Number}
 */
WindowMessage.CONNECT = 7;

export {WindowMessage};