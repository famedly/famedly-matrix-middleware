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
let got = got_1.default;
function setGotFn(g) {
    got = g;
}
exports.setGotFn = setGotFn;
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
            const authRes = yield got({
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
            const authRes = yield got({
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7Ozs7Ozs7RUFlRTs7Ozs7Ozs7Ozs7QUFHRix1REFBdUQ7QUFDdkQsNkJBQThDO0FBRTlDLE1BQU0sa0JBQWtCLEdBQUcsR0FBRyxDQUFDO0FBQy9CLE1BQU0sbUJBQW1CLEdBQUcsR0FBRyxDQUFDO0FBQ2hDLE1BQU0sZ0JBQWdCLEdBQUcsR0FBRyxDQUFDO0FBQzdCLE1BQU0sNEJBQTRCLEdBQUcsR0FBRyxDQUFDO0FBRXpDLElBQUksR0FBRyxHQUFHLGFBQU8sQ0FBQztBQUVsQixTQUFnQixRQUFRLENBQUMsQ0FBTTtJQUM5QixHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQ1QsQ0FBQztBQUZELDRCQUVDO0FBRUQsU0FBZ0IsZ0JBQWdCO0lBQy9CLE9BQU8sQ0FBQyxHQUFvQixFQUFFLEdBQXFCLEVBQUUsSUFBMEIsRUFBRSxFQUFFO1FBQ2xGLE1BQU0sYUFBYSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDbEQsSUFBSSxhQUFhLEVBQUU7WUFDbEIsTUFBTSxPQUFPLEdBQUcsYUFBYSxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1lBQ3RELElBQUksT0FBTyxFQUFFO2dCQUNaLEdBQUcsQ0FBQyxXQUFXLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQzdCO1NBQ0Q7UUFDRCxJQUFJLENBQUMsR0FBRyxDQUFDLFdBQVcsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLFlBQVksRUFBRTtZQUMvQyxHQUFHLENBQUMsV0FBVyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDO1NBQ3pDO1FBQ0QsSUFBSSxFQUFFLENBQUM7SUFDUixDQUFDLENBQUM7QUFDSCxDQUFDO0FBZEQsNENBY0M7QUFNRCxTQUFnQixtQkFBbUIsQ0FBQyxhQUFx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