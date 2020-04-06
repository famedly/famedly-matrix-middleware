"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const expressRateLimit = require("express-rate-limit");
const got_1 = require("got");
const STATUS_BAD_REQUEST = 400;
const STATUS_UNAUTHORIZED = 401;
const STATUS_FORBIDDEN = 403;
const STATUS_INTERNAL_SERVER_ERROR = 500;
function parseAccessToken() {
    return (req, res, next) => {
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
exports.parseAccessToken = parseAccessToken;
function validateAccessToken(homeserverUrl) {
    return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        if (!req.accessToken) {
            parseAccessToken()(req, res, () => { });
        }
        if (!req.accessToken) {
            next();
            return;
        }
        try {
            const authRes = yield got_1.default({
                method: "GET",
                url: homeserverUrl + "/_matrix/client/r0/account/whoami",
                headers: {
                    Authorization: `Bearer ${req.accessToken}`,
                },
            }).json();
            if (!authRes || typeof authRes.user_id !== "string") {
                next();
                return;
            }
            req.authUserId = authRes.user_id;
            next();
        }
        catch (err) {
            next();
        }
    });
}
exports.validateAccessToken = validateAccessToken;
function requireAccessToken(homeserverUrl) {
    return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        if (!req.accessToken) {
            parseAccessToken()(req, res, () => { });
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
            const authRes = yield got_1.default({
                method: "GET",
                url: homeserverUrl + "/_matrix/client/r0/account/whoami",
                headers: {
                    Authorization: `Bearer ${req.accessToken}`,
                },
            }).json();
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
        }
        catch (err) {
            if (err instanceof got_1.HTTPError) {
                try {
                    const errBody = JSON.parse(err.response.body);
                    if (errBody && errBody.errcode === "M_UNKNOWN_TOKEN") {
                        res.status(STATUS_FORBIDDEN);
                        res.json({
                            errcode: "M_UNKNOWN_TOKEN",
                            error: "Unrecognized access token",
                            soft_logout: false,
                        });
                        return;
                    }
                }
                catch (err) { }
            }
            res.status(STATUS_INTERNAL_SERVER_ERROR);
            res.json({
                errcode: "M_UNKNOWN",
                error: "Backend unreachable",
            });
        }
    });
}
exports.requireAccessToken = requireAccessToken;
function validateJson() {
    return (req, res, next) => {
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
exports.validateJson = validateJson;
function accessControlHeaders() {
    return (req, res, next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
        next();
    };
}
exports.accessControlHeaders = accessControlHeaders;
const WINDOW_RETRY_EXTRA = 100;
const DEFAULT_WIDNOW_MS = 60000;
function rateLimit(opts) {
    let limiter = null;
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
    return (req, res, next) => {
        if (!limiter) {
            next();
            return;
        }
        limiter(req, res, next);
    };
}
exports.rateLimit = rateLimit;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7Ozs7Ozs7RUFlRTs7Ozs7Ozs7Ozs7QUFHRix1REFBdUQ7QUFDdkQsNkJBQXFDO0FBRXJDLE1BQU0sa0JBQWtCLEdBQUcsR0FBRyxDQUFDO0FBQy9CLE1BQU0sbUJBQW1CLEdBQUcsR0FBRyxDQUFDO0FBQ2hDLE1BQU0sZ0JBQWdCLEdBQUcsR0FBRyxDQUFDO0FBQzdCLE1BQU0sNEJBQTRCLEdBQUcsR0FBRyxDQUFDO0FBRXpDLFNBQWdCLGdCQUFnQjtJQUMvQixPQUFPLENBQUMsR0FBb0IsRUFBRSxHQUFxQixFQUFFLElBQTBCLEVBQUUsRUFBRTtRQUNsRixNQUFNLGFBQWEsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ2xELElBQUksYUFBYSxFQUFFO1lBQ2xCLE1BQU0sT0FBTyxHQUFHLGFBQWEsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztZQUN0RCxJQUFJLE9BQU8sRUFBRTtnQkFDWixHQUFHLENBQUMsV0FBVyxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUM3QjtTQUNEO1FBQ0QsSUFBSSxDQUFDLEdBQUcsQ0FBQyxXQUFXLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxZQUFZLEVBQUU7WUFDL0MsR0FBRyxDQUFDLFdBQVcsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQztTQUN6QztRQUNELElBQUksRUFBRSxDQUFDO0lBQ1IsQ0FBQyxDQUFDO0FBQ0gsQ0FBQztBQWRELDRDQWNDO0FBTUQsU0FBZ0IsbUJBQW1CLENBQUMsYUFBcUI7SUFDeEQsT0FBTyxDQUFPLEdBQW9CLEVBQUUsR0FBcUIsRUFBRSxJQUEwQixFQUFFLEVBQUU7UUFDeEYsSUFBSSxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUU7WUFDckIsZ0JBQWdC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