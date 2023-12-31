/*
Copyright (C) 2020, 2021 Famedly

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <http://www.gnu.org/licenses/>.
*/

import { expect } from "chai";
import { parseAccessToken, validateJson, accessControlHeaders, rateLimit } from "../src/index";
import * as proxyquire from "proxyquire";
import { HTTPError } from "got";

// we are a test file and thus our linting rules are slightly different
// tslint:disable:no-unused-expression max-file-line-count no-any no-magic-numbers no-string-literal

const proxyquireGot = { default: (opts) => {
	switch (opts.headers.Authorization) {
		case "Bearer goodfox":
			return {
				json: async () => {
					return {
						user_id: "@fox:localhost",
					};
				},
			};
		case "Bearer badfox":
			return {
				json: async () => {
					return { };
				},
			};
		case "Bearer invalidfox":
			const error = new HTTPError({} as any);
			Object.defineProperty(error, "response", {
				enumerable: false,
				value: { body: "{\"errcode\": \"M_UNKNOWN_TOKEN\"}"},
			});
			throw error;
		default:
			throw new Error("bad login");
	}
}};

function getValidateAccessToken() {
	const validateAccessToken = proxyquire.load("../src/index", {
		got: proxyquireGot,
	}).validateAccessToken;
	return validateAccessToken("");
}

function getRequireAccessToken() {
	const requireAccessToken = proxyquire.load("../src/index", {
		got: proxyquireGot,
	}).requireAccessToken;
	return requireAccessToken("");
}

async function delay(ms) {
	return new Promise((resolve, reject) => {
		setTimeout(resolve, ms);
	});
}

const STATUS_OK = 200;
const STATUS_CREATED = 201;
const STATUS_BAD_REQUEST = 400;
const STATUS_UNAUTHORIZED = 401;
const STATUS_FORBIDDEN = 403;
const STATUS_NOT_FOUND = 404;
const STATUS_CONFLICT = 409;
const STATUS_INTERNAL_SERVER_ERROR = 500;

let RES_STATUS = STATUS_OK;
let RES_SEND = "";
let RES_JSON = {} as any;
function getRes() {
	RES_STATUS = STATUS_OK;
	RES_SEND = "";
	RES_JSON = {};
	const res = {
		status: (status) => {
			RES_STATUS = status;
			return res;
		},
		send: (text) => {
			RES_SEND = text;
		},
		json: (obj) => {
			RES_JSON = obj;
		},
		setHeader: (h, v) => { },
	} as any;
	return res;
}

let NEXT_CALLED = false;
function getNext() {
	NEXT_CALLED = false;
	return () => {
		NEXT_CALLED = true;
	};
}

describe("parseAccessToken", () => {
	it("should not populate anything, if no token is present", () => {
		const req: any = {
			header: () => null,
			query: {},
		};
		parseAccessToken()(req, getRes(), getNext());
		expect(NEXT_CALLED).to.be.true;
		expect(req.accessToken).to.be.undefined;
	});
	it("should not populate anything, if the authorization header is invalid", () => {
		const req: any = {
			header: () => "blah",
			query: {},
		};
		parseAccessToken()(req, getRes(), getNext());
		expect(NEXT_CALLED).to.be.true;
		expect(req.accessToken).to.be.undefined;
	});
	it("should populate the token, if the header is valid", () => {
		const req: any = {
			header: () => "Bearer fox",
			query: {},
		};
		parseAccessToken()(req, getRes(), getNext());
		expect(NEXT_CALLED).to.be.true;
		expect(req.accessToken).to.equal("fox");
	});
	it("should populate the token, if a query string is given", () => {
		const req: any = {
			header: () => null,
			query: { access_token: "fox" },
		};
		parseAccessToken()(req, getRes(), getNext());
		expect(NEXT_CALLED).to.be.true;
		expect(req.accessToken).to.equal("fox");
	});
});
describe("validateAccessToken", () => {
	it("should not validate, if no access token is found", async () => {
		const req: any = {
			header: () => null,
			query: {},
		};
		await getValidateAccessToken()(req, getRes(), getNext());
		expect(NEXT_CALLED).to.be.true;
		expect(req.authUserId).to.be.undefined;
	});
	it("should accept valid access tokens", async () => {
		const req: any = {
			header: () => "Bearer goodfox",
			query: {},
		};
		await getValidateAccessToken()(req, getRes(), getNext());
		expect(NEXT_CALLED).to.be.true;
		expect(req.authUserId).to.equal("@fox:localhost");
	});
	it("should not validate blank replies", async () => {
		const req: any = {
			header: () => "Bearer badfox",
			query: {},
		};
		await getValidateAccessToken()(req, getRes(), getNext());
		expect(NEXT_CALLED).to.be.true;
		expect(req.authUserId).to.be.undefined;
	});
	it("should not validate unknown access tokens", async () => {
		const req: any = {
			header: () => "Bearer invalidfox",
			query: {},
		};
		await getValidateAccessToken()(req, getRes(), getNext());
		expect(NEXT_CALLED).to.be.true;
		expect(req.authUserId).to.be.undefined;
	});
});
describe("requireAccessToken", () => {
	it("should deny, if no access token is found", async () => {
		const req: any = {
			header: () => null,
			query: {},
		};
		await getRequireAccessToken()(req, getRes(), getNext());
		expect(NEXT_CALLED).to.be.false;
		expect(RES_STATUS).to.equal(STATUS_FORBIDDEN);
		expect(RES_JSON).to.eql({
			errcode: "M_MISSING_TOKEN",
			error: "Missing access token",
		});
	});
	it("should accept valid access tokens", async () => {
		const req: any = {
			header: () => "Bearer goodfox",
			query: {},
		};
		await getRequireAccessToken()(req, getRes(), getNext());
		expect(NEXT_CALLED).to.be.true;
		expect(req.authUserId).to.equal("@fox:localhost");
	});
	it("should deny blank replies", async () => {
		const req: any = {
			header: () => "Bearer badfox",
			query: {},
		};
		await getRequireAccessToken()(req, getRes(), getNext());
		expect(NEXT_CALLED).to.be.false;
		expect(RES_STATUS).to.equal(STATUS_FORBIDDEN);
		expect(RES_JSON).to.eql({
			errcode: "M_UNKNOWN_TOKEN",
			error: "Unrecognized access token",
			soft_logout: false,
		});
	});
	it("should correctly recognize unknown access tokens", async () => {
		const req: any = {
			header: () => "Bearer invalidfox",
			query: {},
		};
		await getRequireAccessToken()(req, getRes(), getNext());
		expect(NEXT_CALLED).to.be.false;
		expect(RES_STATUS).to.equal(STATUS_FORBIDDEN);
		expect(RES_JSON).to.eql({
			errcode: "M_UNKNOWN_TOKEN",
			error: "Unrecognized access token",
			soft_logout: false,
		});
	});
	it("should complain about an unreachable backend", async () => {
		const req: any = {
			header: () => "Bearer superbadfox",
			query: {},
		};
		await getRequireAccessToken()(req, getRes(), getNext());
		expect(NEXT_CALLED).to.be.false;
		expect(RES_STATUS).to.equal(STATUS_INTERNAL_SERVER_ERROR);
		expect(RES_JSON).to.eql({
			errcode: "M_UNKNOWN",
			error: "Backend unreachable",
		});
	});
});
describe("validateJson", () => {
	it("should complain if a request post-like method is missing a body", () => {
		for (const method of ["POST", "PUT", "PATCH"]) {
			const req = { method } as any;
			validateJson()(req, getRes(), getNext());
			expect(NEXT_CALLED).to.be.false;
			expect(RES_STATUS).to.equal(STATUS_BAD_REQUEST);
			expect(RES_JSON.errcode).to.equal("M_NOT_JSON");
			expect(RES_JSON.error).to.equal("No JSON submitted");
		}
	});
	it("should leave get-like methods alone", () => {
		for (const method of ["GET", "DELETE"]) {
			const req = { method } as any;
			validateJson()(req, getRes(), getNext());
			expect(NEXT_CALLED).to.be.true;
		}
	});
	it("should pass on post-like methods, if they have a body", () => {
		for (const method of ["POST", "PUT", "PATCH"]) {
			const req = { method, body: {} } as any;
			validateJson()(req, getRes(), getNext());
			expect(NEXT_CALLED).to.be.true;
		}
	});
});
describe("rateLimit", () => {
	it("should work, if enabled", async () => {
		const limit = rateLimit({
			windowMs: 50,
			max: 2,
			enabled: true,
		});
		limit({} as any, getRes(), getNext());
		await delay(3);
		expect(NEXT_CALLED).to.be.true;
		limit({} as any, getRes(), getNext());
		await delay(3);
		expect(NEXT_CALLED).to.be.true;
		limit({} as any, getRes(), getNext());
		await delay(3);
		expect(NEXT_CALLED).to.be.false;
		await delay(70);
		limit({} as any, getRes(), getNext());
		await delay(3);
		expect(NEXT_CALLED).to.be.true;
	});
	it("should just pass-through, if disabled", () => {
		const limit = rateLimit({
			windowMs: 50,
			max: 2,
			enabled: false,
		});
		limit({} as any, getRes(), getNext());
		expect(NEXT_CALLED).to.be.true;
		limit({} as any, getRes(), getNext());
		expect(NEXT_CALLED).to.be.true;
		limit({} as any, getRes(), getNext());
		expect(NEXT_CALLED).to.be.true;
	});
});
