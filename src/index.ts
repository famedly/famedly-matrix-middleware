/*
Copyright (C) 2020 Famedly

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

import * as express from "express";
import * as expressRateLimit from "express-rate-limit";
import got, { HTTPError } from "got";

const STATUS_BAD_REQUEST = 400;
const STATUS_UNAUTHORIZED = 401;
const STATUS_FORBIDDEN = 403;
const STATUS_INTERNAL_SERVER_ERROR = 500;

export function parseAccessToken(): express.RequestHandler {
	return (req: express.Request, res: express.Response, next: express.NextFunction) => {
		const authorization = req.header("Authorization");
		if (authorization) {
			const matches = authorization.match(/^Bearer (.*)$/i);
			if (matches) {
				req.accessToken = matches[1];
			}
		}
		if (!req.accessToken && req.query.access_token) {
			req.accessToken = req.query.access_token;
		}
		next();
	};
}

interface IAuthRes {
	user_id?: string;
}

export function validateAccessToken(homeserverUrl: string): express.RequestHandler {
	return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
		if (!req.accessToken) {
			parseAccessToken()(req, res, () => {});
		}
		if (!req.accessToken) {
			next();
			return;
		}
		try {
			const authRes = await got({
				method: "GET",
				url: homeserverUrl + "/_matrix/client/r0/account/whoami",
				headers: {
					Authorization: `Bearer ${req.accessToken}`,
				},
			}).json() as IAuthRes;
			if (!authRes || typeof authRes.user_id !== "string") {
				next();
				return;
			}
			req.authUserId = authRes.user_id;
			next();
		} catch (err) {
			next();
		}
	};
}

export function requireAccessToken(homeserverUrl: string): express.RequestHandler {
	return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
		if (!req.accessToken) {
			parseAccessToken()(req, res, () => {});
		}
		if (!req.accessToken) {
			res.status(STATUS_FORBIDDEN);
			res.json({
				errcode: "M_MISSING_TOKEN",
				error: "Missing access token",
			});
			return;
		}
		try {
			const authRes = await got({
				method: "GET",
				url: homeserverUrl + "/_matrix/client/r0/account/whoami",
				headers: {
					Authorization: `Bearer ${req.accessToken}`,
				},
			}).json() as IAuthRes;
			if (!authRes || typeof authRes.user_id !== "string") {
				res.status(STATUS_FORBIDDEN);
				res.json({
					errcode: "M_UNKNOWN_TOKEN",
					error: "Unrecognized access token",
					soft_logout: false,
				});
				return;
			}
			req.authUserId = authRes.user_id;
			next();
		} catch (err) {
			if (err instanceof HTTPError) {
				try {
					const errBody = JSON.parse(err.response.body as string);
					if (errBody && errBody.errcode === "M_UNKNOWN_TOKEN") {
						res.status(STATUS_FORBIDDEN);
						res.json({
							errcode: "M_UNKNOWN_TOKEN",
							error: "Unrecognized access token",
							soft_logout: false,
						});
						return;
					}
				} catch (err) { }
			}
			res.status(STATUS_INTERNAL_SERVER_ERROR);
			res.json({
				errcode: "M_UNKNOWN",
				error: "Backend unreachable",
			});
		}
	};
}

export function validateJson(): express.RequestHandler {
	return (req: express.Request, res: express.Response, next: express.NextFunction) => {
		if (["POST", "PUT", "PATCH"].includes(req.method) && !(req.body instanceof Object)) {
			res.status(STATUS_BAD_REQUEST);
			res.json({
				errcode: "M_NOT_JSON",
				error: "No JSON submitted",
			});
			return;
		}
		next();
	};
}

export function accessControlHeaders(): express.RequestHandler {
	return (req: express.Request, res: express.Response, next: express.NextFunction) => {
		res.header("Access-Control-Allow-Origin", "*");
		res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
		res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
		next();
	};
}

export interface IRateLimitOptions {
	windowMs?: number;
	max?: number;
	message?: any; // tslint:disable-line no-any
	enabled: boolean;
}

const WINDOW_RETRY_EXTRA = 100;
const DEFAULT_WIDNOW_MS = 60000;

export function rateLimit(opts: IRateLimitOptions): express.RequestHandler {
	let limiter: expressRateLimit.RateLimit | null = null;
	if (opts.enabled) {
		limiter = expressRateLimit({
			windowMs: opts.windowMs || DEFAULT_WIDNOW_MS,
			max: opts.max,
			message: opts.message || {
				errcode: "M_LIMIT_EXCEEDED",
				error: "Too many requests",
				retry_after_ms: (opts.windowMs || DEFAULT_WIDNOW_MS) + WINDOW_RETRY_EXTRA,
			},
		});
	}
	return (req: express.Request, res: express.Response, next: express.NextFunction) => {
		if (!limiter) {
			next();
			return;
		}
		limiter(req, res, next);
	};
}
