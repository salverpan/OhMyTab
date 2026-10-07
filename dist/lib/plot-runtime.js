/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
var Pu = function(r, t) {
  return Pu = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(e, i) {
    e.__proto__ = i;
  } || function(e, i) {
    for (var n in i) Object.prototype.hasOwnProperty.call(i, n) && (e[n] = i[n]);
  }, Pu(r, t);
};
function F(r, t) {
  if (typeof t != "function" && t !== null)
    throw new TypeError("Class extends value " + String(t) + " is not a constructor or null");
  Pu(r, t);
  function e() {
    this.constructor = r;
  }
  r.prototype = t === null ? Object.create(t) : (e.prototype = t.prototype, new e());
}
var A_ = /* @__PURE__ */ (function() {
  function r() {
    this.firefox = !1, this.ie = !1, this.edge = !1, this.newEdge = !1, this.weChat = !1;
  }
  return r;
})(), I_ = /* @__PURE__ */ (function() {
  function r() {
    this.browser = new A_(), this.node = !1, this.wxa = !1, this.worker = !1, this.svgSupported = !1, this.touchEventsSupported = !1, this.pointerEventsSupported = !1, this.domSupported = !1, this.transformSupported = !1, this.transform3dSupported = !1, this.hasGlobalWindow = typeof window < "u";
  }
  return r;
})(), Y = new I_();
typeof wx == "object" && typeof wx.getSystemInfoSync == "function" ? (Y.wxa = !0, Y.touchEventsSupported = !0) : typeof document > "u" && typeof self < "u" ? Y.worker = !0 : !Y.hasGlobalWindow || "Deno" in window ? (Y.node = !0, Y.svgSupported = !0) : L_(navigator.userAgent, Y);
function L_(r, t) {
  var e = t.browser, i = r.match(/Firefox\/([\d.]+)/), n = r.match(/MSIE\s([\d.]+)/) || r.match(/Trident\/.+?rv:(([\d.]+))/), a = r.match(/Edge?\/([\d.]+)/), o = /micromessenger/i.test(r);
  i && (e.firefox = !0, e.version = i[1]), n && (e.ie = !0, e.version = n[1]), a && (e.edge = !0, e.version = a[1], e.newEdge = +a[1].split(".")[0] > 18), o && (e.weChat = !0), t.svgSupported = typeof SVGRect < "u", t.touchEventsSupported = "ontouchstart" in window && !e.ie && !e.edge, t.pointerEventsSupported = "onpointerdown" in window && (e.edge || e.ie && +e.version >= 11), t.domSupported = typeof document < "u";
  var s = document.documentElement.style;
  t.transform3dSupported = (e.ie && "transition" in s || e.edge || "WebKitCSSMatrix" in window && "m11" in new WebKitCSSMatrix() || "MozPerspective" in s) && !("OTransition" in s), t.transformSupported = t.transform3dSupported || e.ie && +e.version >= 9;
}
var Yf = 12, P_ = "sans-serif", vi = Yf + "px " + P_, R_ = 20, E_ = 100, O_ = "007LLmW'55;N0500LLLLLLLLLL00NNNLzWW\\\\WQb\\0FWLg\\bWb\\WQ\\WrWWQ000CL5LLFLL0LL**F*gLLLL5F0LF\\FFF5.5N";
function k_(r) {
  var t = {};
  if (typeof JSON > "u")
    return t;
  for (var e = 0; e < r.length; e++) {
    var i = String.fromCharCode(e + 32), n = (r.charCodeAt(e) - R_) / E_;
    t[i] = n;
  }
  return t;
}
var N_ = k_(O_), Re = {
  createCanvas: function() {
    return typeof document < "u" && document.createElement("canvas");
  },
  measureText: /* @__PURE__ */ (function() {
    var r, t;
    return function(e, i) {
      if (!r) {
        var n = Re.createCanvas();
        r = n && n.getContext("2d");
      }
      if (r)
        return t !== i && (t = r.font = i || vi), r.measureText(e);
      e = e || "", i = i || vi;
      var a = /((?:\d+)?\.?\d*)px/.exec(i), o = a && +a[1] || Yf, s = 0;
      if (i.indexOf("mono") >= 0)
        s = o * e.length;
      else
        for (var l = 0; l < e.length; l++) {
          var u = N_[e[l]];
          s += u == null ? o : u * o;
        }
      return { width: s };
    };
  })(),
  loadImage: function(r, t, e) {
    var i = new Image();
    return i.onload = t, i.onerror = e, i.src = r, i;
  }
};
function _g(r) {
  for (var t in Re)
    r[t] && (Re[t] = r[t]);
}
var Sg = We([
  "Function",
  "RegExp",
  "Date",
  "Error",
  "CanvasGradient",
  "CanvasPattern",
  "Image",
  "Canvas"
], function(r, t) {
  return r["[object " + t + "]"] = !0, r;
}, {}), bg = We([
  "Int8",
  "Uint8",
  "Uint8Clamped",
  "Int16",
  "Uint16",
  "Int32",
  "Uint32",
  "Float32",
  "Float64"
], function(r, t) {
  return r["[object " + t + "Array]"] = !0, r;
}, {}), en = Object.prototype.toString, ms = Array.prototype, B_ = ms.forEach, z_ = ms.filter, Xf = ms.slice, F_ = ms.map, cv = function() {
}.constructor, ka = cv ? cv.prototype : null, $f = "__proto__", V_ = 2311;
function Zf() {
  return V_++;
}
function _s() {
  for (var r = [], t = 0; t < arguments.length; t++)
    r[t] = arguments[t];
  typeof console < "u" && console.error.apply(console, r);
}
function U(r) {
  if (r == null || typeof r != "object")
    return r;
  var t = r, e = en.call(r);
  if (e === "[object Array]") {
    if (!Wi(r)) {
      t = [];
      for (var i = 0, n = r.length; i < n; i++)
        t[i] = U(r[i]);
    }
  } else if (bg[e]) {
    if (!Wi(r)) {
      var a = r.constructor;
      if (a.from)
        t = a.from(r);
      else {
        t = new a(r.length);
        for (var i = 0, n = r.length; i < n; i++)
          t[i] = r[i];
      }
    }
  } else if (!Sg[e] && !Wi(r) && !Qi(r)) {
    t = {};
    for (var o in r)
      r.hasOwnProperty(o) && o !== $f && (t[o] = U(r[o]));
  }
  return t;
}
function j(r, t, e) {
  if (!H(t) || !H(r))
    return e ? U(t) : r;
  for (var i in t)
    if (t.hasOwnProperty(i) && i !== $f) {
      var n = r[i], a = t[i];
      H(a) && H(n) && !O(a) && !O(n) && !Qi(a) && !Qi(n) && !Ru(a) && !Ru(n) && !Wi(a) && !Wi(n) ? j(n, a, e) : (e || !(i in r)) && (r[i] = U(t[i]));
    }
  return r;
}
function H_(r, t) {
  for (var e = r[0], i = 1, n = r.length; i < n; i++)
    e = j(e, r[i], t);
  return e;
}
function k(r, t) {
  if (Object.assign)
    Object.assign(r, t);
  else
    for (var e in t)
      t.hasOwnProperty(e) && e !== $f && (r[e] = t[e]);
  return r;
}
function at(r, t, e) {
  for (var i = ct(t), n = 0, a = i.length; n < a; n++) {
    var o = i[n];
    (e ? t[o] != null : r[o] == null) && (r[o] = t[o]);
  }
  return r;
}
var G_ = Re.createCanvas;
function nt(r, t) {
  if (r) {
    if (r.indexOf)
      return r.indexOf(t);
    for (var e = 0, i = r.length; e < i; e++)
      if (r[e] === t)
        return e;
  }
  return -1;
}
function qf(r, t) {
  var e = r.prototype;
  function i() {
  }
  i.prototype = t.prototype, r.prototype = new i();
  for (var n in e)
    e.hasOwnProperty(n) && (r.prototype[n] = e[n]);
  r.prototype.constructor = r, r.superClass = t;
}
function ie(r, t, e) {
  if (r = "prototype" in r ? r.prototype : r, t = "prototype" in t ? t.prototype : t, Object.getOwnPropertyNames)
    for (var i = Object.getOwnPropertyNames(t), n = 0; n < i.length; n++) {
      var a = i[n];
      a !== "constructor" && (e ? t[a] != null : r[a] == null) && (r[a] = t[a]);
    }
  else
    at(r, t, e);
}
function Ht(r) {
  return !r || typeof r == "string" ? !1 : typeof r.length == "number";
}
function T(r, t, e) {
  if (r && t)
    if (r.forEach && r.forEach === B_)
      r.forEach(t, e);
    else if (r.length === +r.length)
      for (var i = 0, n = r.length; i < n; i++)
        t.call(e, r[i], i, r);
    else
      for (var a in r)
        r.hasOwnProperty(a) && t.call(e, r[a], a, r);
}
function z(r, t, e) {
  if (!r)
    return [];
  if (!t)
    return Ss(r);
  if (r.map && r.map === F_)
    return r.map(t, e);
  for (var i = [], n = 0, a = r.length; n < a; n++)
    i.push(t.call(e, r[n], n, r));
  return i;
}
function We(r, t, e, i) {
  if (r && t) {
    for (var n = 0, a = r.length; n < a; n++)
      e = t.call(i, e, r[n], n, r);
    return e;
  }
}
function xt(r, t, e) {
  if (!r)
    return [];
  if (!t)
    return Ss(r);
  if (r.filter && r.filter === z_)
    return r.filter(t, e);
  for (var i = [], n = 0, a = r.length; n < a; n++)
    t.call(e, r[n], n, r) && i.push(r[n]);
  return i;
}
function W_(r, t, e) {
  if (r && t) {
    for (var i = 0, n = r.length; i < n; i++)
      if (t.call(e, r[i], i, r))
        return r[i];
  }
}
function ct(r) {
  if (!r)
    return [];
  if (Object.keys)
    return Object.keys(r);
  var t = [];
  for (var e in r)
    r.hasOwnProperty(e) && t.push(e);
  return t;
}
function U_(r, t) {
  for (var e = [], i = 2; i < arguments.length; i++)
    e[i - 2] = arguments[i];
  return function() {
    return r.apply(t, e.concat(Xf.call(arguments)));
  };
}
var Q = ka && X(ka.bind) ? ka.call.bind(ka.bind) : U_;
function ht(r) {
  for (var t = [], e = 1; e < arguments.length; e++)
    t[e - 1] = arguments[e];
  return function() {
    return r.apply(this, t.concat(Xf.call(arguments)));
  };
}
function O(r) {
  return Array.isArray ? Array.isArray(r) : en.call(r) === "[object Array]";
}
function X(r) {
  return typeof r == "function";
}
function V(r) {
  return typeof r == "string";
}
function Go(r) {
  return en.call(r) === "[object String]";
}
function vt(r) {
  return typeof r == "number";
}
function H(r) {
  var t = typeof r;
  return t === "function" || !!r && t === "object";
}
function Ru(r) {
  return !!Sg[en.call(r)];
}
function Gt(r) {
  return !!bg[en.call(r)];
}
function Qi(r) {
  return typeof r == "object" && typeof r.nodeType == "number" && typeof r.ownerDocument == "object";
}
function _a(r) {
  return r.colorStops != null;
}
function wg(r) {
  return r.image != null;
}
function Y_(r) {
  return en.call(r) === "[object RegExp]";
}
function Jn(r) {
  return r !== r;
}
function Cr() {
  for (var r = [], t = 0; t < arguments.length; t++)
    r[t] = arguments[t];
  for (var e = 0, i = r.length; e < i; e++)
    if (r[e] != null)
      return r[e];
}
function Z(r, t) {
  return r ?? t;
}
function zn(r, t, e) {
  return r ?? t ?? e;
}
function Ss(r) {
  for (var t = [], e = 1; e < arguments.length; e++)
    t[e - 1] = arguments[e];
  return Xf.apply(r, t);
}
function Kf(r) {
  if (typeof r == "number")
    return [r, r, r, r];
  var t = r.length;
  return t === 2 ? [r[0], r[1], r[0], r[1]] : t === 3 ? [r[0], r[1], r[2], r[1]] : r;
}
function Ee(r, t) {
  if (!r)
    throw new Error(t);
}
function Me(r) {
  return r == null ? null : typeof r.trim == "function" ? r.trim() : r.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "");
}
var xg = "__ec_primitive__";
function Wo(r) {
  r[xg] = !0;
}
function Wi(r) {
  return r[xg];
}
var X_ = (function() {
  function r() {
    this.data = {};
  }
  return r.prototype.delete = function(t) {
    var e = this.has(t);
    return e && delete this.data[t], e;
  }, r.prototype.has = function(t) {
    return this.data.hasOwnProperty(t);
  }, r.prototype.get = function(t) {
    return this.data[t];
  }, r.prototype.set = function(t, e) {
    return this.data[t] = e, this;
  }, r.prototype.keys = function() {
    return ct(this.data);
  }, r.prototype.forEach = function(t) {
    var e = this.data;
    for (var i in e)
      e.hasOwnProperty(i) && t(e[i], i);
  }, r;
})(), Tg = typeof Map == "function";
function $_() {
  return Tg ? /* @__PURE__ */ new Map() : new X_();
}
var Cg = (function() {
  function r(t) {
    var e = O(t);
    this.data = $_();
    var i = this;
    t instanceof r ? t.each(n) : t && T(t, n);
    function n(a, o) {
      e ? i.set(a, o) : i.set(o, a);
    }
  }
  return r.prototype.hasKey = function(t) {
    return this.data.has(t);
  }, r.prototype.get = function(t) {
    return this.data.get(t);
  }, r.prototype.set = function(t, e) {
    return this.data.set(t, e), e;
  }, r.prototype.each = function(t, e) {
    this.data.forEach(function(i, n) {
      t.call(e, i, n);
    });
  }, r.prototype.keys = function() {
    var t = this.data.keys();
    return Tg ? Array.from(t) : t;
  }, r.prototype.removeKey = function(t) {
    this.data.delete(t);
  }, r;
})();
function q(r) {
  return new Cg(r);
}
function Mg(r, t) {
  for (var e = new r.constructor(r.length + t.length), i = 0; i < r.length; i++)
    e[i] = r[i];
  for (var n = r.length, i = 0; i < t.length; i++)
    e[i + n] = t[i];
  return e;
}
function Sa(r, t) {
  var e;
  if (Object.create)
    e = Object.create(r);
  else {
    var i = function() {
    };
    i.prototype = r, e = new i();
  }
  return t && k(e, t), e;
}
function Qf(r) {
  var t = r.style;
  t.webkitUserSelect = "none", t.userSelect = "none", t.webkitTapHighlightColor = "rgba(0,0,0,0)", t["-webkit-touch-callout"] = "none";
}
function Mr(r, t) {
  return r.hasOwnProperty(t);
}
function Rt() {
}
var Dg = 180 / Math.PI;
const Z_ = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  HashMap: Cg,
  RADIAN_TO_DEGREE: Dg,
  assert: Ee,
  bind: Q,
  clone: U,
  concatArray: Mg,
  createCanvas: G_,
  createHashMap: q,
  createObject: Sa,
  curry: ht,
  defaults: at,
  disableUserSelect: Qf,
  each: T,
  eqNaN: Jn,
  extend: k,
  filter: xt,
  find: W_,
  guid: Zf,
  hasOwn: Mr,
  indexOf: nt,
  inherits: qf,
  isArray: O,
  isArrayLike: Ht,
  isBuiltInObject: Ru,
  isDom: Qi,
  isFunction: X,
  isGradientObject: _a,
  isImagePatternObject: wg,
  isNumber: vt,
  isObject: H,
  isPrimitive: Wi,
  isRegExp: Y_,
  isString: V,
  isStringSafe: Go,
  isTypedArray: Gt,
  keys: ct,
  logError: _s,
  map: z,
  merge: j,
  mergeAll: H_,
  mixin: ie,
  noop: Rt,
  normalizeCssArray: Kf,
  reduce: We,
  retrieve: Cr,
  retrieve2: Z,
  retrieve3: zn,
  setAsPrimitive: Wo,
  slice: Ss,
  trim: Me
}, Symbol.toStringTag, { value: "Module" }));
/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
var Eu = function(r, t) {
  return Eu = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(e, i) {
    e.__proto__ = i;
  } || function(e, i) {
    for (var n in i) Object.prototype.hasOwnProperty.call(i, n) && (e[n] = i[n]);
  }, Eu(r, t);
};
function ut(r, t) {
  if (typeof t != "function" && t !== null)
    throw new TypeError("Class extends value " + String(t) + " is not a constructor or null");
  Eu(r, t);
  function e() {
    this.constructor = r;
  }
  r.prototype = t === null ? Object.create(t) : (e.prototype = t.prototype, new e());
}
function yi(r, t) {
  return r == null && (r = 0), t == null && (t = 0), [r, t];
}
function q_(r, t) {
  return r[0] = t[0], r[1] = t[1], r;
}
function Ag(r) {
  return [r[0], r[1]];
}
function K_(r, t, e) {
  return r[0] = t, r[1] = e, r;
}
function Ou(r, t, e) {
  return r[0] = t[0] + e[0], r[1] = t[1] + e[1], r;
}
function Q_(r, t, e, i) {
  return r[0] = t[0] + e[0] * i, r[1] = t[1] + e[1] * i, r;
}
function Jf(r, t, e) {
  return r[0] = t[0] - e[0], r[1] = t[1] - e[1], r;
}
function jf(r) {
  return Math.sqrt(th(r));
}
var J_ = jf;
function th(r) {
  return r[0] * r[0] + r[1] * r[1];
}
var j_ = th;
function t1(r, t, e) {
  return r[0] = t[0] * e[0], r[1] = t[1] * e[1], r;
}
function e1(r, t, e) {
  return r[0] = t[0] / e[0], r[1] = t[1] / e[1], r;
}
function r1(r, t) {
  return r[0] * t[0] + r[1] * t[1];
}
function Do(r, t, e) {
  return r[0] = t[0] * e, r[1] = t[1] * e, r;
}
function bs(r, t) {
  var e = jf(t);
  return e === 0 ? (r[0] = 0, r[1] = 0) : (r[0] = t[0] / e, r[1] = t[1] / e), r;
}
function Uo(r, t) {
  return Math.sqrt((r[0] - t[0]) * (r[0] - t[0]) + (r[1] - t[1]) * (r[1] - t[1]));
}
var Ig = Uo;
function Lg(r, t) {
  return (r[0] - t[0]) * (r[0] - t[0]) + (r[1] - t[1]) * (r[1] - t[1]);
}
var oi = Lg;
function i1(r, t) {
  return r[0] = -t[0], r[1] = -t[1], r;
}
function n1(r, t, e, i) {
  return r[0] = t[0] + i * (e[0] - t[0]), r[1] = t[1] + i * (e[1] - t[1]), r;
}
function Vt(r, t, e) {
  var i = t[0], n = t[1];
  return r[0] = e[0] * i + e[2] * n + e[4], r[1] = e[1] * i + e[3] * n + e[5], r;
}
function dr(r, t, e) {
  return r[0] = Math.min(t[0], e[0]), r[1] = Math.min(t[1], e[1]), r;
}
function gr(r, t, e) {
  return r[0] = Math.max(t[0], e[0]), r[1] = Math.max(t[1], e[1]), r;
}
const a1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  add: Ou,
  applyTransform: Vt,
  clone: Ag,
  copy: q_,
  create: yi,
  dist: Ig,
  distSquare: oi,
  distance: Uo,
  distanceSquare: Lg,
  div: e1,
  dot: r1,
  len: jf,
  lenSquare: th,
  length: J_,
  lengthSquare: j_,
  lerp: n1,
  max: gr,
  min: dr,
  mul: t1,
  negate: i1,
  normalize: bs,
  scale: Do,
  scaleAndAdd: Q_,
  set: K_,
  sub: Jf
}, Symbol.toStringTag, { value: "Module" }));
var bi = /* @__PURE__ */ (function() {
  function r(t, e) {
    this.target = t, this.topTarget = e && e.topTarget;
  }
  return r;
})(), o1 = (function() {
  function r(t) {
    this.handler = t, t.on("mousedown", this._dragStart, this), t.on("mousemove", this._drag, this), t.on("mouseup", this._dragEnd, this);
  }
  return r.prototype._dragStart = function(t) {
    for (var e = t.target; e && !e.draggable; )
      e = e.parent || e.__hostTarget;
    e && (this._draggingTarget = e, e.dragging = !0, this._x = t.offsetX, this._y = t.offsetY, this.handler.dispatchToElement(new bi(e, t), "dragstart", t.event));
  }, r.prototype._drag = function(t) {
    var e = this._draggingTarget;
    if (e) {
      var i = t.offsetX, n = t.offsetY, a = i - this._x, o = n - this._y;
      this._x = i, this._y = n, e.drift(a, o, t), this.handler.dispatchToElement(new bi(e, t), "drag", t.event);
      var s = this.handler.findHover(i, n, e).target, l = this._dropTarget;
      this._dropTarget = s, e !== s && (l && s !== l && this.handler.dispatchToElement(new bi(l, t), "dragleave", t.event), s && s !== l && this.handler.dispatchToElement(new bi(s, t), "dragenter", t.event));
    }
  }, r.prototype._dragEnd = function(t) {
    var e = this._draggingTarget;
    e && (e.dragging = !1), this.handler.dispatchToElement(new bi(e, t), "dragend", t.event), this._dropTarget && this.handler.dispatchToElement(new bi(this._dropTarget, t), "drop", t.event), this._draggingTarget = null, this._dropTarget = null;
  }, r;
})(), $e = (function() {
  function r(t) {
    t && (this._$eventProcessor = t);
  }
  return r.prototype.on = function(t, e, i, n) {
    this._$handlers || (this._$handlers = {});
    var a = this._$handlers;
    if (typeof e == "function" && (n = i, i = e, e = null), !i || !t)
      return this;
    var o = this._$eventProcessor;
    e != null && o && o.normalizeQuery && (e = o.normalizeQuery(e)), a[t] || (a[t] = []);
    for (var s = 0; s < a[t].length; s++)
      if (a[t][s].h === i)
        return this;
    var l = {
      h: i,
      query: e,
      ctx: n || this,
      callAtLast: i.zrEventfulCallAtLast
    }, u = a[t].length - 1, f = a[t][u];
    return f && f.callAtLast ? a[t].splice(u, 0, l) : a[t].push(l), this;
  }, r.prototype.isSilent = function(t) {
    var e = this._$handlers;
    return !e || !e[t] || !e[t].length;
  }, r.prototype.off = function(t, e) {
    var i = this._$handlers;
    if (!i)
      return this;
    if (!t)
      return this._$handlers = {}, this;
    if (e) {
      if (i[t]) {
        for (var n = [], a = 0, o = i[t].length; a < o; a++)
          i[t][a].h !== e && n.push(i[t][a]);
        i[t] = n;
      }
      i[t] && i[t].length === 0 && delete i[t];
    } else
      delete i[t];
    return this;
  }, r.prototype.trigger = function(t) {
    for (var e = [], i = 1; i < arguments.length; i++)
      e[i - 1] = arguments[i];
    if (!this._$handlers)
      return this;
    var n = this._$handlers[t], a = this._$eventProcessor;
    if (n)
      for (var o = e.length, s = n.length, l = 0; l < s; l++) {
        var u = n[l];
        if (!(a && a.filter && u.query != null && !a.filter(t, u.query)))
          switch (o) {
            case 0:
              u.h.call(u.ctx);
              break;
            case 1:
              u.h.call(u.ctx, e[0]);
              break;
            case 2:
              u.h.call(u.ctx, e[0], e[1]);
              break;
            default:
              u.h.apply(u.ctx, e);
              break;
          }
      }
    return a && a.afterTrigger && a.afterTrigger(t), this;
  }, r.prototype.triggerWithContext = function(t) {
    for (var e = [], i = 1; i < arguments.length; i++)
      e[i - 1] = arguments[i];
    if (!this._$handlers)
      return this;
    var n = this._$handlers[t], a = this._$eventProcessor;
    if (n)
      for (var o = e.length, s = e[o - 1], l = n.length, u = 0; u < l; u++) {
        var f = n[u];
        if (!(a && a.filter && f.query != null && !a.filter(t, f.query)))
          switch (o) {
            case 0:
              f.h.call(s);
              break;
            case 1:
              f.h.call(s, e[0]);
              break;
            case 2:
              f.h.call(s, e[0], e[1]);
              break;
            default:
              f.h.apply(s, e.slice(1, o - 1));
              break;
          }
      }
    return a && a.afterTrigger && a.afterTrigger(t), this;
  }, r;
})(), s1 = Math.log(2);
function ku(r, t, e, i, n, a) {
  var o = i + "-" + n, s = r.length;
  if (a.hasOwnProperty(o))
    return a[o];
  if (t === 1) {
    var l = Math.round(Math.log((1 << s) - 1 & ~n) / s1);
    return r[e][l];
  }
  for (var u = i | 1 << e, f = e + 1; i & 1 << f; )
    f++;
  for (var h = 0, c = 0, v = 0; c < s; c++) {
    var p = 1 << c;
    p & n || (h += (v % 2 ? -1 : 1) * r[e][c] * ku(r, t - 1, f, u, n | p, a), v++);
  }
  return a[o] = h, h;
}
function pv(r, t) {
  var e = [
    [r[0], r[1], 1, 0, 0, 0, -t[0] * r[0], -t[0] * r[1]],
    [0, 0, 0, r[0], r[1], 1, -t[1] * r[0], -t[1] * r[1]],
    [r[2], r[3], 1, 0, 0, 0, -t[2] * r[2], -t[2] * r[3]],
    [0, 0, 0, r[2], r[3], 1, -t[3] * r[2], -t[3] * r[3]],
    [r[4], r[5], 1, 0, 0, 0, -t[4] * r[4], -t[4] * r[5]],
    [0, 0, 0, r[4], r[5], 1, -t[5] * r[4], -t[5] * r[5]],
    [r[6], r[7], 1, 0, 0, 0, -t[6] * r[6], -t[6] * r[7]],
    [0, 0, 0, r[6], r[7], 1, -t[7] * r[6], -t[7] * r[7]]
  ], i = {}, n = ku(e, 8, 0, 0, 0, i);
  if (n !== 0) {
    for (var a = [], o = 0; o < 8; o++)
      for (var s = 0; s < 8; s++)
        a[s] == null && (a[s] = 0), a[s] += ((o + s) % 2 ? -1 : 1) * ku(e, 7, o === 0 ? 1 : 0, 1 << o, 1 << s, i) / n * t[o];
    return function(l, u, f) {
      var h = u * a[6] + f * a[7] + 1;
      l[0] = (u * a[0] + f * a[1] + a[2]) / h, l[1] = (u * a[3] + f * a[4] + a[5]) / h;
    };
  }
}
var dv = "___zrEVENTSAVED", rl = [];
function l1(r, t, e, i, n) {
  return Nu(rl, t, i, n, !0) && Nu(r, e, rl[0], rl[1]);
}
function Nu(r, t, e, i, n) {
  if (t.getBoundingClientRect && Y.domSupported && !Pg(t)) {
    var a = t[dv] || (t[dv] = {}), o = u1(t, a), s = f1(o, a, n);
    if (s)
      return s(r, e, i), !0;
  }
  return !1;
}
function u1(r, t) {
  var e = t.markers;
  if (e)
    return e;
  e = t.markers = [];
  for (var i = ["left", "right"], n = ["top", "bottom"], a = 0; a < 4; a++) {
    var o = document.createElement("div"), s = o.style, l = a % 2, u = (a >> 1) % 2;
    s.cssText = [
      "position: absolute",
      "visibility: hidden",
      "padding: 0",
      "margin: 0",
      "border-width: 0",
      "user-select: none",
      "width:0",
      "height:0",
      i[l] + ":0",
      n[u] + ":0",
      i[1 - l] + ":auto",
      n[1 - u] + ":auto",
      ""
    ].join("!important;"), r.appendChild(o), e.push(o);
  }
  return e;
}
function f1(r, t, e) {
  for (var i = e ? "invTrans" : "trans", n = t[i], a = t.srcCoords, o = [], s = [], l = !0, u = 0; u < 4; u++) {
    var f = r[u].getBoundingClientRect(), h = 2 * u, c = f.left, v = f.top;
    o.push(c, v), l = l && a && c === a[h] && v === a[h + 1], s.push(r[u].offsetLeft, r[u].offsetTop);
  }
  return l && n ? n : (t.srcCoords = o, t[i] = e ? pv(s, o) : pv(o, s));
}
function Pg(r) {
  return r.nodeName.toUpperCase() === "CANVAS";
}
var h1 = /([&<>"'])/g, v1 = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};
function Ft(r) {
  return r == null ? "" : (r + "").replace(h1, function(t, e) {
    return v1[e];
  });
}
var c1 = /^(?:mouse|pointer|contextmenu|drag|drop)|click/, il = [], p1 = Y.browser.firefox && +Y.browser.version.split(".")[0] < 39;
function Bu(r, t, e, i) {
  return e = e || {}, i ? gv(r, t, e) : p1 && t.layerX != null && t.layerX !== t.offsetX ? (e.zrX = t.layerX, e.zrY = t.layerY) : t.offsetX != null ? (e.zrX = t.offsetX, e.zrY = t.offsetY) : gv(r, t, e), e;
}
function gv(r, t, e) {
  if (Y.domSupported && r.getBoundingClientRect) {
    var i = t.clientX, n = t.clientY;
    if (Pg(r)) {
      var a = r.getBoundingClientRect();
      e.zrX = i - a.left, e.zrY = n - a.top;
      return;
    } else if (Nu(il, r, i, n)) {
      e.zrX = il[0], e.zrY = il[1];
      return;
    }
  }
  e.zrX = e.zrY = 0;
}
function eh(r) {
  return r || window.event;
}
function se(r, t, e) {
  if (t = eh(t), t.zrX != null)
    return t;
  var i = t.type, n = i && i.indexOf("touch") >= 0;
  if (n) {
    var o = i !== "touchend" ? t.targetTouches[0] : t.changedTouches[0];
    o && Bu(r, o, t, e);
  } else {
    Bu(r, t, t, e);
    var a = d1(t);
    t.zrDelta = a ? a / 120 : -(t.detail || 0) / 3;
  }
  var s = t.button;
  return t.which == null && s !== void 0 && c1.test(t.type) && (t.which = s & 1 ? 1 : s & 2 ? 3 : s & 4 ? 2 : 0), t;
}
function d1(r) {
  var t = r.wheelDelta;
  if (t)
    return t;
  var e = r.deltaX, i = r.deltaY;
  if (e == null || i == null)
    return t;
  var n = Math.abs(i !== 0 ? i : e), a = i > 0 ? -1 : i < 0 ? 1 : e > 0 ? -1 : 1;
  return 3 * n * a;
}
function g1(r, t, e, i) {
  r.addEventListener(t, e, i);
}
function y1(r, t, e, i) {
  r.removeEventListener(t, e, i);
}
var jn = function(r) {
  r.preventDefault(), r.stopPropagation(), r.cancelBubble = !0;
}, m1 = (function() {
  function r() {
    this._track = [];
  }
  return r.prototype.recognize = function(t, e, i) {
    return this._doTrack(t, e, i), this._recognize(t);
  }, r.prototype.clear = function() {
    return this._track.length = 0, this;
  }, r.prototype._doTrack = function(t, e, i) {
    var n = t.touches;
    if (n) {
      for (var a = {
        points: [],
        touches: [],
        target: e,
        event: t
      }, o = 0, s = n.length; o < s; o++) {
        var l = n[o], u = Bu(i, l, {});
        a.points.push([u.zrX, u.zrY]), a.touches.push(l);
      }
      this._track.push(a);
    }
  }, r.prototype._recognize = function(t) {
    for (var e in nl)
      if (nl.hasOwnProperty(e)) {
        var i = nl[e](this._track, t);
        if (i)
          return i;
      }
  }, r;
})();
function yv(r) {
  var t = r[1][0] - r[0][0], e = r[1][1] - r[0][1];
  return Math.sqrt(t * t + e * e);
}
function _1(r) {
  return [
    (r[0][0] + r[1][0]) / 2,
    (r[0][1] + r[1][1]) / 2
  ];
}
var nl = {
  pinch: function(r, t) {
    var e = r.length;
    if (e) {
      var i = (r[e - 1] || {}).points, n = (r[e - 2] || {}).points || i;
      if (n && n.length > 1 && i && i.length > 1) {
        var a = yv(i) / yv(n);
        !isFinite(a) && (a = 1), t.pinchScale = a;
        var o = _1(i);
        return t.pinchX = o[0], t.pinchY = o[1], {
          type: "pinch",
          target: r[0].target,
          event: t
        };
      }
    }
  }
};
function Sr() {
  return [1, 0, 0, 1, 0, 0];
}
function ba(r) {
  return r[0] = 1, r[1] = 0, r[2] = 0, r[3] = 1, r[4] = 0, r[5] = 0, r;
}
function rh(r, t) {
  return r[0] = t[0], r[1] = t[1], r[2] = t[2], r[3] = t[3], r[4] = t[4], r[5] = t[5], r;
}
function br(r, t, e) {
  var i = t[0] * e[0] + t[2] * e[1], n = t[1] * e[0] + t[3] * e[1], a = t[0] * e[2] + t[2] * e[3], o = t[1] * e[2] + t[3] * e[3], s = t[0] * e[4] + t[2] * e[5] + t[4], l = t[1] * e[4] + t[3] * e[5] + t[5];
  return r[0] = i, r[1] = n, r[2] = a, r[3] = o, r[4] = s, r[5] = l, r;
}
function Yo(r, t, e) {
  return r[0] = t[0], r[1] = t[1], r[2] = t[2], r[3] = t[3], r[4] = t[4] + e[0], r[5] = t[5] + e[1], r;
}
function ws(r, t, e, i) {
  i === void 0 && (i = [0, 0]);
  var n = t[0], a = t[2], o = t[4], s = t[1], l = t[3], u = t[5], f = Math.sin(e), h = Math.cos(e);
  return r[0] = n * h + s * f, r[1] = -n * f + s * h, r[2] = a * h + l * f, r[3] = -a * f + h * l, r[4] = h * (o - i[0]) + f * (u - i[1]) + i[0], r[5] = h * (u - i[1]) - f * (o - i[0]) + i[1], r;
}
function Rg(r, t, e) {
  var i = e[0], n = e[1];
  return r[0] = t[0] * i, r[1] = t[1] * n, r[2] = t[2] * i, r[3] = t[3] * n, r[4] = t[4] * i, r[5] = t[5] * n, r;
}
function wa(r, t) {
  var e = t[0], i = t[2], n = t[4], a = t[1], o = t[3], s = t[5], l = e * o - a * i;
  return l ? (l = 1 / l, r[0] = o * l, r[1] = -a * l, r[2] = -i * l, r[3] = e * l, r[4] = (i * s - o * n) * l, r[5] = (a * n - e * s) * l, r) : null;
}
function S1(r) {
  var t = Sr();
  return rh(t, r), t;
}
const b1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  clone: S1,
  copy: rh,
  create: Sr,
  identity: ba,
  invert: wa,
  mul: br,
  rotate: ws,
  scale: Rg,
  translate: Yo
}, Symbol.toStringTag, { value: "Module" }));
var ft = (function() {
  function r(t, e) {
    this.x = t || 0, this.y = e || 0;
  }
  return r.prototype.copy = function(t) {
    return this.x = t.x, this.y = t.y, this;
  }, r.prototype.clone = function() {
    return new r(this.x, this.y);
  }, r.prototype.set = function(t, e) {
    return this.x = t, this.y = e, this;
  }, r.prototype.equal = function(t) {
    return t.x === this.x && t.y === this.y;
  }, r.prototype.add = function(t) {
    return this.x += t.x, this.y += t.y, this;
  }, r.prototype.scale = function(t) {
    this.x *= t, this.y *= t;
  }, r.prototype.scaleAndAdd = function(t, e) {
    this.x += t.x * e, this.y += t.y * e;
  }, r.prototype.sub = function(t) {
    return this.x -= t.x, this.y -= t.y, this;
  }, r.prototype.dot = function(t) {
    return this.x * t.x + this.y * t.y;
  }, r.prototype.len = function() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }, r.prototype.lenSquare = function() {
    return this.x * this.x + this.y * this.y;
  }, r.prototype.normalize = function() {
    var t = this.len();
    return this.x /= t, this.y /= t, this;
  }, r.prototype.distance = function(t) {
    var e = this.x - t.x, i = this.y - t.y;
    return Math.sqrt(e * e + i * i);
  }, r.prototype.distanceSquare = function(t) {
    var e = this.x - t.x, i = this.y - t.y;
    return e * e + i * i;
  }, r.prototype.negate = function() {
    return this.x = -this.x, this.y = -this.y, this;
  }, r.prototype.transform = function(t) {
    if (t) {
      var e = this.x, i = this.y;
      return this.x = t[0] * e + t[2] * i + t[4], this.y = t[1] * e + t[3] * i + t[5], this;
    }
  }, r.prototype.toArray = function(t) {
    return t[0] = this.x, t[1] = this.y, t;
  }, r.prototype.fromArray = function(t) {
    this.x = t[0], this.y = t[1];
  }, r.set = function(t, e, i) {
    t.x = e, t.y = i;
  }, r.copy = function(t, e) {
    t.x = e.x, t.y = e.y;
  }, r.len = function(t) {
    return Math.sqrt(t.x * t.x + t.y * t.y);
  }, r.lenSquare = function(t) {
    return t.x * t.x + t.y * t.y;
  }, r.dot = function(t, e) {
    return t.x * e.x + t.y * e.y;
  }, r.add = function(t, e, i) {
    t.x = e.x + i.x, t.y = e.y + i.y;
  }, r.sub = function(t, e, i) {
    t.x = e.x - i.x, t.y = e.y - i.y;
  }, r.scale = function(t, e, i) {
    t.x = e.x * i, t.y = e.y * i;
  }, r.scaleAndAdd = function(t, e, i, n) {
    t.x = e.x + i.x * n, t.y = e.y + i.y * n;
  }, r.lerp = function(t, e, i, n) {
    var a = 1 - n;
    t.x = a * e.x + n * i.x, t.y = a * e.y + n * i.y;
  }, r;
})(), Na = Math.min, Ba = Math.max, Er = new ft(), Or = new ft(), kr = new ft(), Nr = new ft(), fn = new ft(), hn = new ft(), it = (function() {
  function r(t, e, i, n) {
    i < 0 && (t = t + i, i = -i), n < 0 && (e = e + n, n = -n), this.x = t, this.y = e, this.width = i, this.height = n;
  }
  return r.prototype.union = function(t) {
    var e = Na(t.x, this.x), i = Na(t.y, this.y);
    isFinite(this.x) && isFinite(this.width) ? this.width = Ba(t.x + t.width, this.x + this.width) - e : this.width = t.width, isFinite(this.y) && isFinite(this.height) ? this.height = Ba(t.y + t.height, this.y + this.height) - i : this.height = t.height, this.x = e, this.y = i;
  }, r.prototype.applyTransform = function(t) {
    r.applyTransform(this, this, t);
  }, r.prototype.calculateTransform = function(t) {
    var e = this, i = t.width / e.width, n = t.height / e.height, a = Sr();
    return Yo(a, a, [-e.x, -e.y]), Rg(a, a, [i, n]), Yo(a, a, [t.x, t.y]), a;
  }, r.prototype.intersect = function(t, e) {
    if (!t)
      return !1;
    t instanceof r || (t = r.create(t));
    var i = this, n = i.x, a = i.x + i.width, o = i.y, s = i.y + i.height, l = t.x, u = t.x + t.width, f = t.y, h = t.y + t.height, c = !(a < l || u < n || s < f || h < o);
    if (e) {
      var v = 1 / 0, p = 0, g = Math.abs(a - l), d = Math.abs(u - n), y = Math.abs(s - f), m = Math.abs(h - o), _ = Math.min(g, d), S = Math.min(y, m);
      a < l || u < n ? _ > p && (p = _, g < d ? ft.set(hn, -g, 0) : ft.set(hn, d, 0)) : _ < v && (v = _, g < d ? ft.set(fn, g, 0) : ft.set(fn, -d, 0)), s < f || h < o ? S > p && (p = S, y < m ? ft.set(hn, 0, -y) : ft.set(hn, 0, m)) : _ < v && (v = _, y < m ? ft.set(fn, 0, y) : ft.set(fn, 0, -m));
    }
    return e && ft.copy(e, c ? fn : hn), c;
  }, r.prototype.contain = function(t, e) {
    var i = this;
    return t >= i.x && t <= i.x + i.width && e >= i.y && e <= i.y + i.height;
  }, r.prototype.clone = function() {
    return new r(this.x, this.y, this.width, this.height);
  }, r.prototype.copy = function(t) {
    r.copy(this, t);
  }, r.prototype.plain = function() {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height
    };
  }, r.prototype.isFinite = function() {
    return isFinite(this.x) && isFinite(this.y) && isFinite(this.width) && isFinite(this.height);
  }, r.prototype.isZero = function() {
    return this.width === 0 || this.height === 0;
  }, r.create = function(t) {
    return new r(t.x, t.y, t.width, t.height);
  }, r.copy = function(t, e) {
    t.x = e.x, t.y = e.y, t.width = e.width, t.height = e.height;
  }, r.applyTransform = function(t, e, i) {
    if (!i) {
      t !== e && r.copy(t, e);
      return;
    }
    if (i[1] < 1e-5 && i[1] > -1e-5 && i[2] < 1e-5 && i[2] > -1e-5) {
      var n = i[0], a = i[3], o = i[4], s = i[5];
      t.x = e.x * n + o, t.y = e.y * a + s, t.width = e.width * n, t.height = e.height * a, t.width < 0 && (t.x += t.width, t.width = -t.width), t.height < 0 && (t.y += t.height, t.height = -t.height);
      return;
    }
    Er.x = kr.x = e.x, Er.y = Nr.y = e.y, Or.x = Nr.x = e.x + e.width, Or.y = kr.y = e.y + e.height, Er.transform(i), Nr.transform(i), Or.transform(i), kr.transform(i), t.x = Na(Er.x, Or.x, kr.x, Nr.x), t.y = Na(Er.y, Or.y, kr.y, Nr.y);
    var l = Ba(Er.x, Or.x, kr.x, Nr.x), u = Ba(Er.y, Or.y, kr.y, Nr.y);
    t.width = l - t.x, t.height = u - t.y;
  }, r;
})(), Eg = "silent";
function w1(r, t, e) {
  return {
    type: r,
    event: e,
    target: t.target,
    topTarget: t.topTarget,
    cancelBubble: !1,
    offsetX: e.zrX,
    offsetY: e.zrY,
    gestureEvent: e.gestureEvent,
    pinchX: e.pinchX,
    pinchY: e.pinchY,
    pinchScale: e.pinchScale,
    wheelDelta: e.zrDelta,
    zrByTouch: e.zrByTouch,
    which: e.which,
    stop: x1
  };
}
function x1() {
  jn(this.event);
}
var T1 = (function(r) {
  ut(t, r);
  function t() {
    var e = r !== null && r.apply(this, arguments) || this;
    return e.handler = null, e;
  }
  return t.prototype.dispose = function() {
  }, t.prototype.setCursor = function() {
  }, t;
})($e), vn = /* @__PURE__ */ (function() {
  function r(t, e) {
    this.x = t, this.y = e;
  }
  return r;
})(), C1 = [
  "click",
  "dblclick",
  "mousewheel",
  "mouseout",
  "mouseup",
  "mousedown",
  "mousemove",
  "contextmenu"
], al = new it(0, 0, 0, 0), Og = (function(r) {
  ut(t, r);
  function t(e, i, n, a, o) {
    var s = r.call(this) || this;
    return s._hovered = new vn(0, 0), s.storage = e, s.painter = i, s.painterRoot = a, s._pointerSize = o, n = n || new T1(), s.proxy = null, s.setHandlerProxy(n), s._draggingMgr = new o1(s), s;
  }
  return t.prototype.setHandlerProxy = function(e) {
    this.proxy && this.proxy.dispose(), e && (T(C1, function(i) {
      e.on && e.on(i, this[i], this);
    }, this), e.handler = this), this.proxy = e;
  }, t.prototype.mousemove = function(e) {
    var i = e.zrX, n = e.zrY, a = kg(this, i, n), o = this._hovered, s = o.target;
    s && !s.__zr && (o = this.findHover(o.x, o.y), s = o.target);
    var l = this._hovered = a ? new vn(i, n) : this.findHover(i, n), u = l.target, f = this.proxy;
    f.setCursor && f.setCursor(u ? u.cursor : "default"), s && u !== s && this.dispatchToElement(o, "mouseout", e), this.dispatchToElement(l, "mousemove", e), u && u !== s && this.dispatchToElement(l, "mouseover", e);
  }, t.prototype.mouseout = function(e) {
    var i = e.zrEventControl;
    i !== "only_globalout" && this.dispatchToElement(this._hovered, "mouseout", e), i !== "no_globalout" && this.trigger("globalout", { type: "globalout", event: e });
  }, t.prototype.resize = function() {
    this._hovered = new vn(0, 0);
  }, t.prototype.dispatch = function(e, i) {
    var n = this[e];
    n && n.call(this, i);
  }, t.prototype.dispose = function() {
    this.proxy.dispose(), this.storage = null, this.proxy = null, this.painter = null;
  }, t.prototype.setCursorStyle = function(e) {
    var i = this.proxy;
    i.setCursor && i.setCursor(e);
  }, t.prototype.dispatchToElement = function(e, i, n) {
    e = e || {};
    var a = e.target;
    if (!(a && a.silent)) {
      for (var o = "on" + i, s = w1(i, e, n); a && (a[o] && (s.cancelBubble = !!a[o].call(a, s)), a.trigger(i, s), a = a.__hostTarget ? a.__hostTarget : a.parent, !s.cancelBubble); )
        ;
      s.cancelBubble || (this.trigger(i, s), this.painter && this.painter.eachOtherLayer && this.painter.eachOtherLayer(function(l) {
        typeof l[o] == "function" && l[o].call(l, s), l.trigger && l.trigger(i, s);
      }));
    }
  }, t.prototype.findHover = function(e, i, n) {
    var a = this.storage.getDisplayList(), o = new vn(e, i);
    if (mv(a, o, e, i, n), this._pointerSize && !o.target) {
      for (var s = [], l = this._pointerSize, u = l / 2, f = new it(e - u, i - u, l, l), h = a.length - 1; h >= 0; h--) {
        var c = a[h];
        c !== n && !c.ignore && !c.ignoreCoarsePointer && (!c.parent || !c.parent.ignoreCoarsePointer) && (al.copy(c.getBoundingRect()), c.transform && al.applyTransform(c.transform), al.intersect(f) && s.push(c));
      }
      if (s.length)
        for (var v = 4, p = Math.PI / 12, g = Math.PI * 2, d = 0; d < u; d += v)
          for (var y = 0; y < g; y += p) {
            var m = e + d * Math.cos(y), _ = i + d * Math.sin(y);
            if (mv(s, o, m, _, n), o.target)
              return o;
          }
    }
    return o;
  }, t.prototype.processGesture = function(e, i) {
    this._gestureMgr || (this._gestureMgr = new m1());
    var n = this._gestureMgr;
    i === "start" && n.clear();
    var a = n.recognize(e, this.findHover(e.zrX, e.zrY, null).target, this.proxy.dom);
    if (i === "end" && n.clear(), a) {
      var o = a.type;
      e.gestureEvent = o;
      var s = new vn();
      s.target = a.target, this.dispatchToElement(s, o, a.event);
    }
  }, t;
})($e);
T(["click", "mousedown", "mouseup", "mousewheel", "dblclick", "contextmenu"], function(r) {
  Og.prototype[r] = function(t) {
    var e = t.zrX, i = t.zrY, n = kg(this, e, i), a, o;
    if ((r !== "mouseup" || !n) && (a = this.findHover(e, i), o = a.target), r === "mousedown")
      this._downEl = o, this._downPoint = [t.zrX, t.zrY], this._upEl = o;
    else if (r === "mouseup")
      this._upEl = o;
    else if (r === "click") {
      if (this._downEl !== this._upEl || !this._downPoint || Ig(this._downPoint, [t.zrX, t.zrY]) > 4)
        return;
      this._downPoint = null;
    }
    this.dispatchToElement(a, r, t);
  };
});
function M1(r, t, e) {
  if (r[r.rectHover ? "rectContain" : "contain"](t, e)) {
    for (var i = r, n = void 0, a = !1; i; ) {
      if (i.ignoreClip && (a = !0), !a) {
        var o = i.getClipPath();
        if (o && !o.contain(t, e))
          return !1;
      }
      i.silent && (n = !0);
      var s = i.__hostTarget;
      i = s || i.parent;
    }
    return n ? Eg : !0;
  }
  return !1;
}
function mv(r, t, e, i, n) {
  for (var a = r.length - 1; a >= 0; a--) {
    var o = r[a], s = void 0;
    if (o !== n && !o.ignore && (s = M1(o, e, i)) && (!t.topTarget && (t.topTarget = o), s !== Eg)) {
      t.target = o;
      break;
    }
  }
}
function kg(r, t, e) {
  var i = r.painter;
  return t < 0 || t > i.getWidth() || e < 0 || e > i.getHeight();
}
var Ng = 32, cn = 7;
function D1(r) {
  for (var t = 0; r >= Ng; )
    t |= r & 1, r >>= 1;
  return r + t;
}
function _v(r, t, e, i) {
  var n = t + 1;
  if (n === e)
    return 1;
  if (i(r[n++], r[t]) < 0) {
    for (; n < e && i(r[n], r[n - 1]) < 0; )
      n++;
    A1(r, t, n);
  } else
    for (; n < e && i(r[n], r[n - 1]) >= 0; )
      n++;
  return n - t;
}
function A1(r, t, e) {
  for (e--; t < e; ) {
    var i = r[t];
    r[t++] = r[e], r[e--] = i;
  }
}
function Sv(r, t, e, i, n) {
  for (i === t && i++; i < e; i++) {
    for (var a = r[i], o = t, s = i, l; o < s; )
      l = o + s >>> 1, n(a, r[l]) < 0 ? s = l : o = l + 1;
    var u = i - o;
    switch (u) {
      case 3:
        r[o + 3] = r[o + 2];
      case 2:
        r[o + 2] = r[o + 1];
      case 1:
        r[o + 1] = r[o];
        break;
      default:
        for (; u > 0; )
          r[o + u] = r[o + u - 1], u--;
    }
    r[o] = a;
  }
}
function ol(r, t, e, i, n, a) {
  var o = 0, s = 0, l = 1;
  if (a(r, t[e + n]) > 0) {
    for (s = i - n; l < s && a(r, t[e + n + l]) > 0; )
      o = l, l = (l << 1) + 1, l <= 0 && (l = s);
    l > s && (l = s), o += n, l += n;
  } else {
    for (s = n + 1; l < s && a(r, t[e + n - l]) <= 0; )
      o = l, l = (l << 1) + 1, l <= 0 && (l = s);
    l > s && (l = s);
    var u = o;
    o = n - l, l = n - u;
  }
  for (o++; o < l; ) {
    var f = o + (l - o >>> 1);
    a(r, t[e + f]) > 0 ? o = f + 1 : l = f;
  }
  return l;
}
function sl(r, t, e, i, n, a) {
  var o = 0, s = 0, l = 1;
  if (a(r, t[e + n]) < 0) {
    for (s = n + 1; l < s && a(r, t[e + n - l]) < 0; )
      o = l, l = (l << 1) + 1, l <= 0 && (l = s);
    l > s && (l = s);
    var u = o;
    o = n - l, l = n - u;
  } else {
    for (s = i - n; l < s && a(r, t[e + n + l]) >= 0; )
      o = l, l = (l << 1) + 1, l <= 0 && (l = s);
    l > s && (l = s), o += n, l += n;
  }
  for (o++; o < l; ) {
    var f = o + (l - o >>> 1);
    a(r, t[e + f]) < 0 ? l = f : o = f + 1;
  }
  return l;
}
function I1(r, t) {
  var e = cn, i, n, a = 0, o = [];
  i = [], n = [];
  function s(v, p) {
    i[a] = v, n[a] = p, a += 1;
  }
  function l() {
    for (; a > 1; ) {
      var v = a - 2;
      if (v >= 1 && n[v - 1] <= n[v] + n[v + 1] || v >= 2 && n[v - 2] <= n[v] + n[v - 1])
        n[v - 1] < n[v + 1] && v--;
      else if (n[v] > n[v + 1])
        break;
      f(v);
    }
  }
  function u() {
    for (; a > 1; ) {
      var v = a - 2;
      v > 0 && n[v - 1] < n[v + 1] && v--, f(v);
    }
  }
  function f(v) {
    var p = i[v], g = n[v], d = i[v + 1], y = n[v + 1];
    n[v] = g + y, v === a - 3 && (i[v + 1] = i[v + 2], n[v + 1] = n[v + 2]), a--;
    var m = sl(r[d], r, p, g, 0, t);
    p += m, g -= m, g !== 0 && (y = ol(r[p + g - 1], r, d, y, y - 1, t), y !== 0 && (g <= y ? h(p, g, d, y) : c(p, g, d, y)));
  }
  function h(v, p, g, d) {
    var y = 0;
    for (y = 0; y < p; y++)
      o[y] = r[v + y];
    var m = 0, _ = g, S = v;
    if (r[S++] = r[_++], --d === 0) {
      for (y = 0; y < p; y++)
        r[S + y] = o[m + y];
      return;
    }
    if (p === 1) {
      for (y = 0; y < d; y++)
        r[S + y] = r[_ + y];
      r[S + d] = o[m];
      return;
    }
    for (var w = e, b, x, M; ; ) {
      b = 0, x = 0, M = !1;
      do
        if (t(r[_], o[m]) < 0) {
          if (r[S++] = r[_++], x++, b = 0, --d === 0) {
            M = !0;
            break;
          }
        } else if (r[S++] = o[m++], b++, x = 0, --p === 1) {
          M = !0;
          break;
        }
      while ((b | x) < w);
      if (M)
        break;
      do {
        if (b = sl(r[_], o, m, p, 0, t), b !== 0) {
          for (y = 0; y < b; y++)
            r[S + y] = o[m + y];
          if (S += b, m += b, p -= b, p <= 1) {
            M = !0;
            break;
          }
        }
        if (r[S++] = r[_++], --d === 0) {
          M = !0;
          break;
        }
        if (x = ol(o[m], r, _, d, 0, t), x !== 0) {
          for (y = 0; y < x; y++)
            r[S + y] = r[_ + y];
          if (S += x, _ += x, d -= x, d === 0) {
            M = !0;
            break;
          }
        }
        if (r[S++] = o[m++], --p === 1) {
          M = !0;
          break;
        }
        w--;
      } while (b >= cn || x >= cn);
      if (M)
        break;
      w < 0 && (w = 0), w += 2;
    }
    if (e = w, e < 1 && (e = 1), p === 1) {
      for (y = 0; y < d; y++)
        r[S + y] = r[_ + y];
      r[S + d] = o[m];
    } else {
      if (p === 0)
        throw new Error();
      for (y = 0; y < p; y++)
        r[S + y] = o[m + y];
    }
  }
  function c(v, p, g, d) {
    var y = 0;
    for (y = 0; y < d; y++)
      o[y] = r[g + y];
    var m = v + p - 1, _ = d - 1, S = g + d - 1, w = 0, b = 0;
    if (r[S--] = r[m--], --p === 0) {
      for (w = S - (d - 1), y = 0; y < d; y++)
        r[w + y] = o[y];
      return;
    }
    if (d === 1) {
      for (S -= p, m -= p, b = S + 1, w = m + 1, y = p - 1; y >= 0; y--)
        r[b + y] = r[w + y];
      r[S] = o[_];
      return;
    }
    for (var x = e; ; ) {
      var M = 0, D = 0, A = !1;
      do
        if (t(o[_], r[m]) < 0) {
          if (r[S--] = r[m--], M++, D = 0, --p === 0) {
            A = !0;
            break;
          }
        } else if (r[S--] = o[_--], D++, M = 0, --d === 1) {
          A = !0;
          break;
        }
      while ((M | D) < x);
      if (A)
        break;
      do {
        if (M = p - sl(o[_], r, v, p, p - 1, t), M !== 0) {
          for (S -= M, m -= M, p -= M, b = S + 1, w = m + 1, y = M - 1; y >= 0; y--)
            r[b + y] = r[w + y];
          if (p === 0) {
            A = !0;
            break;
          }
        }
        if (r[S--] = o[_--], --d === 1) {
          A = !0;
          break;
        }
        if (D = d - ol(r[m], o, 0, d, d - 1, t), D !== 0) {
          for (S -= D, _ -= D, d -= D, b = S + 1, w = _ + 1, y = 0; y < D; y++)
            r[b + y] = o[w + y];
          if (d <= 1) {
            A = !0;
            break;
          }
        }
        if (r[S--] = r[m--], --p === 0) {
          A = !0;
          break;
        }
        x--;
      } while (M >= cn || D >= cn);
      if (A)
        break;
      x < 0 && (x = 0), x += 2;
    }
    if (e = x, e < 1 && (e = 1), d === 1) {
      for (S -= p, m -= p, b = S + 1, w = m + 1, y = p - 1; y >= 0; y--)
        r[b + y] = r[w + y];
      r[S] = o[_];
    } else {
      if (d === 0)
        throw new Error();
      for (w = S - (d - 1), y = 0; y < d; y++)
        r[w + y] = o[y];
    }
  }
  return {
    mergeRuns: l,
    forceMergeRuns: u,
    pushRun: s
  };
}
function Ao(r, t, e, i) {
  e || (e = 0), i || (i = r.length);
  var n = i - e;
  if (!(n < 2)) {
    var a = 0;
    if (n < Ng) {
      a = _v(r, e, i, t), Sv(r, e, i, e + a, t);
      return;
    }
    var o = I1(r, t), s = D1(n);
    do {
      if (a = _v(r, e, i, t), a < s) {
        var l = n;
        l > s && (l = s), Sv(r, e, e + l, e + a, t), a = l;
      }
      o.pushRun(e, a), o.mergeRuns(), n -= a, e += a;
    } while (n !== 0);
    o.forceMergeRuns();
  }
}
var te = 1, Pn = 2, zi = 4, bv = !1;
function ll() {
  bv || (bv = !0, console.warn("z / z2 / zlevel of displayable is invalid, which may cause unexpected errors"));
}
function wv(r, t) {
  return r.zlevel === t.zlevel ? r.z === t.z ? r.z2 - t.z2 : r.z - t.z : r.zlevel - t.zlevel;
}
var L1 = (function() {
  function r() {
    this._roots = [], this._displayList = [], this._displayListLen = 0, this.displayableSortFunc = wv;
  }
  return r.prototype.traverse = function(t, e) {
    for (var i = 0; i < this._roots.length; i++)
      this._roots[i].traverse(t, e);
  }, r.prototype.getDisplayList = function(t, e) {
    e = e || !1;
    var i = this._displayList;
    return (t || !i.length) && this.updateDisplayList(e), i;
  }, r.prototype.updateDisplayList = function(t) {
    this._displayListLen = 0;
    for (var e = this._roots, i = this._displayList, n = 0, a = e.length; n < a; n++)
      this._updateAndAddDisplayable(e[n], null, t);
    i.length = this._displayListLen, Ao(i, wv);
  }, r.prototype._updateAndAddDisplayable = function(t, e, i) {
    if (!(t.ignore && !i)) {
      t.beforeUpdate(), t.update(), t.afterUpdate();
      var n = t.getClipPath();
      if (t.ignoreClip)
        e = null;
      else if (n) {
        e ? e = e.slice() : e = [];
        for (var a = n, o = t; a; )
          a.parent = o, a.updateTransform(), e.push(a), o = a, a = a.getClipPath();
      }
      if (t.childrenRef) {
        for (var s = t.childrenRef(), l = 0; l < s.length; l++) {
          var u = s[l];
          t.__dirty && (u.__dirty |= te), this._updateAndAddDisplayable(u, e, i);
        }
        t.__dirty = 0;
      } else {
        var f = t;
        e && e.length ? f.__clipPaths = e : f.__clipPaths && f.__clipPaths.length > 0 && (f.__clipPaths = []), isNaN(f.z) && (ll(), f.z = 0), isNaN(f.z2) && (ll(), f.z2 = 0), isNaN(f.zlevel) && (ll(), f.zlevel = 0), this._displayList[this._displayListLen++] = f;
      }
      var h = t.getDecalElement && t.getDecalElement();
      h && this._updateAndAddDisplayable(h, e, i);
      var c = t.getTextGuideLine();
      c && this._updateAndAddDisplayable(c, e, i);
      var v = t.getTextContent();
      v && this._updateAndAddDisplayable(v, e, i);
    }
  }, r.prototype.addRoot = function(t) {
    t.__zr && t.__zr.storage === this || this._roots.push(t);
  }, r.prototype.delRoot = function(t) {
    if (t instanceof Array) {
      for (var e = 0, i = t.length; e < i; e++)
        this.delRoot(t[e]);
      return;
    }
    var n = nt(this._roots, t);
    n >= 0 && this._roots.splice(n, 1);
  }, r.prototype.delAllRoots = function() {
    this._roots = [], this._displayList = [], this._displayListLen = 0;
  }, r.prototype.getRoots = function() {
    return this._roots;
  }, r.prototype.dispose = function() {
    this._displayList = null, this._roots = null;
  }, r;
})(), Xo;
Xo = Y.hasGlobalWindow && (window.requestAnimationFrame && window.requestAnimationFrame.bind(window) || window.msRequestAnimationFrame && window.msRequestAnimationFrame.bind(window) || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame) || function(r) {
  return setTimeout(r, 16);
};
var Fn = {
  linear: function(r) {
    return r;
  },
  quadraticIn: function(r) {
    return r * r;
  },
  quadraticOut: function(r) {
    return r * (2 - r);
  },
  quadraticInOut: function(r) {
    return (r *= 2) < 1 ? 0.5 * r * r : -0.5 * (--r * (r - 2) - 1);
  },
  cubicIn: function(r) {
    return r * r * r;
  },
  cubicOut: function(r) {
    return --r * r * r + 1;
  },
  cubicInOut: function(r) {
    return (r *= 2) < 1 ? 0.5 * r * r * r : 0.5 * ((r -= 2) * r * r + 2);
  },
  quarticIn: function(r) {
    return r * r * r * r;
  },
  quarticOut: function(r) {
    return 1 - --r * r * r * r;
  },
  quarticInOut: function(r) {
    return (r *= 2) < 1 ? 0.5 * r * r * r * r : -0.5 * ((r -= 2) * r * r * r - 2);
  },
  quinticIn: function(r) {
    return r * r * r * r * r;
  },
  quinticOut: function(r) {
    return --r * r * r * r * r + 1;
  },
  quinticInOut: function(r) {
    return (r *= 2) < 1 ? 0.5 * r * r * r * r * r : 0.5 * ((r -= 2) * r * r * r * r + 2);
  },
  sinusoidalIn: function(r) {
    return 1 - Math.cos(r * Math.PI / 2);
  },
  sinusoidalOut: function(r) {
    return Math.sin(r * Math.PI / 2);
  },
  sinusoidalInOut: function(r) {
    return 0.5 * (1 - Math.cos(Math.PI * r));
  },
  exponentialIn: function(r) {
    return r === 0 ? 0 : Math.pow(1024, r - 1);
  },
  exponentialOut: function(r) {
    return r === 1 ? 1 : 1 - Math.pow(2, -10 * r);
  },
  exponentialInOut: function(r) {
    return r === 0 ? 0 : r === 1 ? 1 : (r *= 2) < 1 ? 0.5 * Math.pow(1024, r - 1) : 0.5 * (-Math.pow(2, -10 * (r - 1)) + 2);
  },
  circularIn: function(r) {
    return 1 - Math.sqrt(1 - r * r);
  },
  circularOut: function(r) {
    return Math.sqrt(1 - --r * r);
  },
  circularInOut: function(r) {
    return (r *= 2) < 1 ? -0.5 * (Math.sqrt(1 - r * r) - 1) : 0.5 * (Math.sqrt(1 - (r -= 2) * r) + 1);
  },
  elasticIn: function(r) {
    var t, e = 0.1, i = 0.4;
    return r === 0 ? 0 : r === 1 ? 1 : (!e || e < 1 ? (e = 1, t = i / 4) : t = i * Math.asin(1 / e) / (2 * Math.PI), -(e * Math.pow(2, 10 * (r -= 1)) * Math.sin((r - t) * (2 * Math.PI) / i)));
  },
  elasticOut: function(r) {
    var t, e = 0.1, i = 0.4;
    return r === 0 ? 0 : r === 1 ? 1 : (!e || e < 1 ? (e = 1, t = i / 4) : t = i * Math.asin(1 / e) / (2 * Math.PI), e * Math.pow(2, -10 * r) * Math.sin((r - t) * (2 * Math.PI) / i) + 1);
  },
  elasticInOut: function(r) {
    var t, e = 0.1, i = 0.4;
    return r === 0 ? 0 : r === 1 ? 1 : (!e || e < 1 ? (e = 1, t = i / 4) : t = i * Math.asin(1 / e) / (2 * Math.PI), (r *= 2) < 1 ? -0.5 * (e * Math.pow(2, 10 * (r -= 1)) * Math.sin((r - t) * (2 * Math.PI) / i)) : e * Math.pow(2, -10 * (r -= 1)) * Math.sin((r - t) * (2 * Math.PI) / i) * 0.5 + 1);
  },
  backIn: function(r) {
    var t = 1.70158;
    return r * r * ((t + 1) * r - t);
  },
  backOut: function(r) {
    var t = 1.70158;
    return --r * r * ((t + 1) * r + t) + 1;
  },
  backInOut: function(r) {
    var t = 2.5949095;
    return (r *= 2) < 1 ? 0.5 * (r * r * ((t + 1) * r - t)) : 0.5 * ((r -= 2) * r * ((t + 1) * r + t) + 2);
  },
  bounceIn: function(r) {
    return 1 - Fn.bounceOut(1 - r);
  },
  bounceOut: function(r) {
    return r < 1 / 2.75 ? 7.5625 * r * r : r < 2 / 2.75 ? 7.5625 * (r -= 1.5 / 2.75) * r + 0.75 : r < 2.5 / 2.75 ? 7.5625 * (r -= 2.25 / 2.75) * r + 0.9375 : 7.5625 * (r -= 2.625 / 2.75) * r + 0.984375;
  },
  bounceInOut: function(r) {
    return r < 0.5 ? Fn.bounceIn(r * 2) * 0.5 : Fn.bounceOut(r * 2 - 1) * 0.5 + 0.5;
  }
}, za = Math.pow, wr = Math.sqrt, $o = 1e-8, Bg = 1e-4, xv = wr(3), Fa = 1 / 3, He = yi(), fe = yi(), Ui = yi();
function yr(r) {
  return r > -$o && r < $o;
}
function zg(r) {
  return r > $o || r < -$o;
}
function Ct(r, t, e, i, n) {
  var a = 1 - n;
  return a * a * (a * r + 3 * n * t) + n * n * (n * i + 3 * a * e);
}
function Tv(r, t, e, i, n) {
  var a = 1 - n;
  return 3 * (((t - r) * a + 2 * (e - t) * n) * a + (i - e) * n * n);
}
function Zo(r, t, e, i, n, a) {
  var o = i + 3 * (t - e) - r, s = 3 * (e - t * 2 + r), l = 3 * (t - r), u = r - n, f = s * s - 3 * o * l, h = s * l - 9 * o * u, c = l * l - 3 * s * u, v = 0;
  if (yr(f) && yr(h))
    if (yr(s))
      a[0] = 0;
    else {
      var p = -l / s;
      p >= 0 && p <= 1 && (a[v++] = p);
    }
  else {
    var g = h * h - 4 * f * c;
    if (yr(g)) {
      var d = h / f, p = -s / o + d, y = -d / 2;
      p >= 0 && p <= 1 && (a[v++] = p), y >= 0 && y <= 1 && (a[v++] = y);
    } else if (g > 0) {
      var m = wr(g), _ = f * s + 1.5 * o * (-h + m), S = f * s + 1.5 * o * (-h - m);
      _ < 0 ? _ = -za(-_, Fa) : _ = za(_, Fa), S < 0 ? S = -za(-S, Fa) : S = za(S, Fa);
      var p = (-s - (_ + S)) / (3 * o);
      p >= 0 && p <= 1 && (a[v++] = p);
    } else {
      var w = (2 * f * s - 3 * o * h) / (2 * wr(f * f * f)), b = Math.acos(w) / 3, x = wr(f), M = Math.cos(b), p = (-s - 2 * x * M) / (3 * o), y = (-s + x * (M + xv * Math.sin(b))) / (3 * o), D = (-s + x * (M - xv * Math.sin(b))) / (3 * o);
      p >= 0 && p <= 1 && (a[v++] = p), y >= 0 && y <= 1 && (a[v++] = y), D >= 0 && D <= 1 && (a[v++] = D);
    }
  }
  return v;
}
function Fg(r, t, e, i, n) {
  var a = 6 * e - 12 * t + 6 * r, o = 9 * t + 3 * i - 3 * r - 9 * e, s = 3 * t - 3 * r, l = 0;
  if (yr(o)) {
    if (zg(a)) {
      var u = -s / a;
      u >= 0 && u <= 1 && (n[l++] = u);
    }
  } else {
    var f = a * a - 4 * o * s;
    if (yr(f))
      n[0] = -a / (2 * o);
    else if (f > 0) {
      var h = wr(f), u = (-a + h) / (2 * o), c = (-a - h) / (2 * o);
      u >= 0 && u <= 1 && (n[l++] = u), c >= 0 && c <= 1 && (n[l++] = c);
    }
  }
  return l;
}
function qo(r, t, e, i, n, a) {
  var o = (t - r) * n + r, s = (e - t) * n + t, l = (i - e) * n + e, u = (s - o) * n + o, f = (l - s) * n + s, h = (f - u) * n + u;
  a[0] = r, a[1] = o, a[2] = u, a[3] = h, a[4] = h, a[5] = f, a[6] = l, a[7] = i;
}
function P1(r, t, e, i, n, a, o, s, l, u, f) {
  var h, c = 5e-3, v = 1 / 0, p, g, d, y;
  He[0] = l, He[1] = u;
  for (var m = 0; m < 1; m += 0.05)
    fe[0] = Ct(r, e, n, o, m), fe[1] = Ct(t, i, a, s, m), d = oi(He, fe), d < v && (h = m, v = d);
  v = 1 / 0;
  for (var _ = 0; _ < 32 && !(c < Bg); _++)
    p = h - c, g = h + c, fe[0] = Ct(r, e, n, o, p), fe[1] = Ct(t, i, a, s, p), d = oi(fe, He), p >= 0 && d < v ? (h = p, v = d) : (Ui[0] = Ct(r, e, n, o, g), Ui[1] = Ct(t, i, a, s, g), y = oi(Ui, He), g <= 1 && y < v ? (h = g, v = y) : c *= 0.5);
  return wr(v);
}
function R1(r, t, e, i, n, a, o, s, l) {
  for (var u = r, f = t, h = 0, c = 1 / l, v = 1; v <= l; v++) {
    var p = v * c, g = Ct(r, e, n, o, p), d = Ct(t, i, a, s, p), y = g - u, m = d - f;
    h += Math.sqrt(y * y + m * m), u = g, f = d;
  }
  return h;
}
function $t(r, t, e, i) {
  var n = 1 - i;
  return n * (n * r + 2 * i * t) + i * i * e;
}
function Cv(r, t, e, i) {
  return 2 * ((1 - i) * (t - r) + i * (e - t));
}
function E1(r, t, e, i, n) {
  var a = r - 2 * t + e, o = 2 * (t - r), s = r - i, l = 0;
  if (yr(a)) {
    if (zg(o)) {
      var u = -s / o;
      u >= 0 && u <= 1 && (n[l++] = u);
    }
  } else {
    var f = o * o - 4 * a * s;
    if (yr(f)) {
      var u = -o / (2 * a);
      u >= 0 && u <= 1 && (n[l++] = u);
    } else if (f > 0) {
      var h = wr(f), u = (-o + h) / (2 * a), c = (-o - h) / (2 * a);
      u >= 0 && u <= 1 && (n[l++] = u), c >= 0 && c <= 1 && (n[l++] = c);
    }
  }
  return l;
}
function Vg(r, t, e) {
  var i = r + e - 2 * t;
  return i === 0 ? 0.5 : (r - t) / i;
}
function Ko(r, t, e, i, n) {
  var a = (t - r) * i + r, o = (e - t) * i + t, s = (o - a) * i + a;
  n[0] = r, n[1] = a, n[2] = s, n[3] = s, n[4] = o, n[5] = e;
}
function O1(r, t, e, i, n, a, o, s, l) {
  var u, f = 5e-3, h = 1 / 0;
  He[0] = o, He[1] = s;
  for (var c = 0; c < 1; c += 0.05) {
    fe[0] = $t(r, e, n, c), fe[1] = $t(t, i, a, c);
    var v = oi(He, fe);
    v < h && (u = c, h = v);
  }
  h = 1 / 0;
  for (var p = 0; p < 32 && !(f < Bg); p++) {
    var g = u - f, d = u + f;
    fe[0] = $t(r, e, n, g), fe[1] = $t(t, i, a, g);
    var v = oi(fe, He);
    if (g >= 0 && v < h)
      u = g, h = v;
    else {
      Ui[0] = $t(r, e, n, d), Ui[1] = $t(t, i, a, d);
      var y = oi(Ui, He);
      d <= 1 && y < h ? (u = d, h = y) : f *= 0.5;
    }
  }
  return wr(h);
}
function k1(r, t, e, i, n, a, o) {
  for (var s = r, l = t, u = 0, f = 1 / o, h = 1; h <= o; h++) {
    var c = h * f, v = $t(r, e, n, c), p = $t(t, i, a, c), g = v - s, d = p - l;
    u += Math.sqrt(g * g + d * d), s = v, l = p;
  }
  return u;
}
var N1 = /cubic-bezier\(([0-9,\.e ]+)\)/;
function Hg(r) {
  var t = r && N1.exec(r);
  if (t) {
    var e = t[1].split(","), i = +Me(e[0]), n = +Me(e[1]), a = +Me(e[2]), o = +Me(e[3]);
    if (isNaN(i + n + a + o))
      return;
    var s = [];
    return function(l) {
      return l <= 0 ? 0 : l >= 1 ? 1 : Zo(0, i, a, 1, l, s) && Ct(0, n, o, 1, s[0]);
    };
  }
}
var B1 = (function() {
  function r(t) {
    this._inited = !1, this._startTime = 0, this._pausedTime = 0, this._paused = !1, this._life = t.life || 1e3, this._delay = t.delay || 0, this.loop = t.loop || !1, this.onframe = t.onframe || Rt, this.ondestroy = t.ondestroy || Rt, this.onrestart = t.onrestart || Rt, t.easing && this.setEasing(t.easing);
  }
  return r.prototype.step = function(t, e) {
    if (this._inited || (this._startTime = t + this._delay, this._inited = !0), this._paused) {
      this._pausedTime += e;
      return;
    }
    var i = this._life, n = t - this._startTime - this._pausedTime, a = n / i;
    a < 0 && (a = 0), a = Math.min(a, 1);
    var o = this.easingFunc, s = o ? o(a) : a;
    if (this.onframe(s), a === 1)
      if (this.loop) {
        var l = n % i;
        this._startTime = t - l, this._pausedTime = 0, this.onrestart();
      } else
        return !0;
    return !1;
  }, r.prototype.pause = function() {
    this._paused = !0;
  }, r.prototype.resume = function() {
    this._paused = !1;
  }, r.prototype.setEasing = function(t) {
    this.easing = t, this.easingFunc = X(t) ? t : Fn[t] || Hg(t);
  }, r;
})(), Gg = /* @__PURE__ */ (function() {
  function r(t) {
    this.value = t;
  }
  return r;
})(), z1 = (function() {
  function r() {
    this._len = 0;
  }
  return r.prototype.insert = function(t) {
    var e = new Gg(t);
    return this.insertEntry(e), e;
  }, r.prototype.insertEntry = function(t) {
    this.head ? (this.tail.next = t, t.prev = this.tail, t.next = null, this.tail = t) : this.head = this.tail = t, this._len++;
  }, r.prototype.remove = function(t) {
    var e = t.prev, i = t.next;
    e ? e.next = i : this.head = i, i ? i.prev = e : this.tail = e, t.next = t.prev = null, this._len--;
  }, r.prototype.len = function() {
    return this._len;
  }, r.prototype.clear = function() {
    this.head = this.tail = null, this._len = 0;
  }, r;
})(), xa = (function() {
  function r(t) {
    this._list = new z1(), this._maxSize = 10, this._map = {}, this._maxSize = t;
  }
  return r.prototype.put = function(t, e) {
    var i = this._list, n = this._map, a = null;
    if (n[t] == null) {
      var o = i.len(), s = this._lastRemovedEntry;
      if (o >= this._maxSize && o > 0) {
        var l = i.head;
        i.remove(l), delete n[l.key], a = l.value, this._lastRemovedEntry = l;
      }
      s ? s.value = e : s = new Gg(e), s.key = t, i.insertEntry(s), n[t] = s;
    }
    return a;
  }, r.prototype.get = function(t) {
    var e = this._map[t], i = this._list;
    if (e != null)
      return e !== i.tail && (i.remove(e), i.insertEntry(e)), e.value;
  }, r.prototype.clear = function() {
    this._list.clear(), this._map = {};
  }, r.prototype.len = function() {
    return this._list.len();
  }, r;
})(), Mv = {
  transparent: [0, 0, 0, 0],
  aliceblue: [240, 248, 255, 1],
  antiquewhite: [250, 235, 215, 1],
  aqua: [0, 255, 255, 1],
  aquamarine: [127, 255, 212, 1],
  azure: [240, 255, 255, 1],
  beige: [245, 245, 220, 1],
  bisque: [255, 228, 196, 1],
  black: [0, 0, 0, 1],
  blanchedalmond: [255, 235, 205, 1],
  blue: [0, 0, 255, 1],
  blueviolet: [138, 43, 226, 1],
  brown: [165, 42, 42, 1],
  burlywood: [222, 184, 135, 1],
  cadetblue: [95, 158, 160, 1],
  chartreuse: [127, 255, 0, 1],
  chocolate: [210, 105, 30, 1],
  coral: [255, 127, 80, 1],
  cornflowerblue: [100, 149, 237, 1],
  cornsilk: [255, 248, 220, 1],
  crimson: [220, 20, 60, 1],
  cyan: [0, 255, 255, 1],
  darkblue: [0, 0, 139, 1],
  darkcyan: [0, 139, 139, 1],
  darkgoldenrod: [184, 134, 11, 1],
  darkgray: [169, 169, 169, 1],
  darkgreen: [0, 100, 0, 1],
  darkgrey: [169, 169, 169, 1],
  darkkhaki: [189, 183, 107, 1],
  darkmagenta: [139, 0, 139, 1],
  darkolivegreen: [85, 107, 47, 1],
  darkorange: [255, 140, 0, 1],
  darkorchid: [153, 50, 204, 1],
  darkred: [139, 0, 0, 1],
  darksalmon: [233, 150, 122, 1],
  darkseagreen: [143, 188, 143, 1],
  darkslateblue: [72, 61, 139, 1],
  darkslategray: [47, 79, 79, 1],
  darkslategrey: [47, 79, 79, 1],
  darkturquoise: [0, 206, 209, 1],
  darkviolet: [148, 0, 211, 1],
  deeppink: [255, 20, 147, 1],
  deepskyblue: [0, 191, 255, 1],
  dimgray: [105, 105, 105, 1],
  dimgrey: [105, 105, 105, 1],
  dodgerblue: [30, 144, 255, 1],
  firebrick: [178, 34, 34, 1],
  floralwhite: [255, 250, 240, 1],
  forestgreen: [34, 139, 34, 1],
  fuchsia: [255, 0, 255, 1],
  gainsboro: [220, 220, 220, 1],
  ghostwhite: [248, 248, 255, 1],
  gold: [255, 215, 0, 1],
  goldenrod: [218, 165, 32, 1],
  gray: [128, 128, 128, 1],
  green: [0, 128, 0, 1],
  greenyellow: [173, 255, 47, 1],
  grey: [128, 128, 128, 1],
  honeydew: [240, 255, 240, 1],
  hotpink: [255, 105, 180, 1],
  indianred: [205, 92, 92, 1],
  indigo: [75, 0, 130, 1],
  ivory: [255, 255, 240, 1],
  khaki: [240, 230, 140, 1],
  lavender: [230, 230, 250, 1],
  lavenderblush: [255, 240, 245, 1],
  lawngreen: [124, 252, 0, 1],
  lemonchiffon: [255, 250, 205, 1],
  lightblue: [173, 216, 230, 1],
  lightcoral: [240, 128, 128, 1],
  lightcyan: [224, 255, 255, 1],
  lightgoldenrodyellow: [250, 250, 210, 1],
  lightgray: [211, 211, 211, 1],
  lightgreen: [144, 238, 144, 1],
  lightgrey: [211, 211, 211, 1],
  lightpink: [255, 182, 193, 1],
  lightsalmon: [255, 160, 122, 1],
  lightseagreen: [32, 178, 170, 1],
  lightskyblue: [135, 206, 250, 1],
  lightslategray: [119, 136, 153, 1],
  lightslategrey: [119, 136, 153, 1],
  lightsteelblue: [176, 196, 222, 1],
  lightyellow: [255, 255, 224, 1],
  lime: [0, 255, 0, 1],
  limegreen: [50, 205, 50, 1],
  linen: [250, 240, 230, 1],
  magenta: [255, 0, 255, 1],
  maroon: [128, 0, 0, 1],
  mediumaquamarine: [102, 205, 170, 1],
  mediumblue: [0, 0, 205, 1],
  mediumorchid: [186, 85, 211, 1],
  mediumpurple: [147, 112, 219, 1],
  mediumseagreen: [60, 179, 113, 1],
  mediumslateblue: [123, 104, 238, 1],
  mediumspringgreen: [0, 250, 154, 1],
  mediumturquoise: [72, 209, 204, 1],
  mediumvioletred: [199, 21, 133, 1],
  midnightblue: [25, 25, 112, 1],
  mintcream: [245, 255, 250, 1],
  mistyrose: [255, 228, 225, 1],
  moccasin: [255, 228, 181, 1],
  navajowhite: [255, 222, 173, 1],
  navy: [0, 0, 128, 1],
  oldlace: [253, 245, 230, 1],
  olive: [128, 128, 0, 1],
  olivedrab: [107, 142, 35, 1],
  orange: [255, 165, 0, 1],
  orangered: [255, 69, 0, 1],
  orchid: [218, 112, 214, 1],
  palegoldenrod: [238, 232, 170, 1],
  palegreen: [152, 251, 152, 1],
  paleturquoise: [175, 238, 238, 1],
  palevioletred: [219, 112, 147, 1],
  papayawhip: [255, 239, 213, 1],
  peachpuff: [255, 218, 185, 1],
  peru: [205, 133, 63, 1],
  pink: [255, 192, 203, 1],
  plum: [221, 160, 221, 1],
  powderblue: [176, 224, 230, 1],
  purple: [128, 0, 128, 1],
  red: [255, 0, 0, 1],
  rosybrown: [188, 143, 143, 1],
  royalblue: [65, 105, 225, 1],
  saddlebrown: [139, 69, 19, 1],
  salmon: [250, 128, 114, 1],
  sandybrown: [244, 164, 96, 1],
  seagreen: [46, 139, 87, 1],
  seashell: [255, 245, 238, 1],
  sienna: [160, 82, 45, 1],
  silver: [192, 192, 192, 1],
  skyblue: [135, 206, 235, 1],
  slateblue: [106, 90, 205, 1],
  slategray: [112, 128, 144, 1],
  slategrey: [112, 128, 144, 1],
  snow: [255, 250, 250, 1],
  springgreen: [0, 255, 127, 1],
  steelblue: [70, 130, 180, 1],
  tan: [210, 180, 140, 1],
  teal: [0, 128, 128, 1],
  thistle: [216, 191, 216, 1],
  tomato: [255, 99, 71, 1],
  turquoise: [64, 224, 208, 1],
  violet: [238, 130, 238, 1],
  wheat: [245, 222, 179, 1],
  white: [255, 255, 255, 1],
  whitesmoke: [245, 245, 245, 1],
  yellow: [255, 255, 0, 1],
  yellowgreen: [154, 205, 50, 1]
};
function Ie(r) {
  return r = Math.round(r), r < 0 ? 0 : r > 255 ? 255 : r;
}
function F1(r) {
  return r = Math.round(r), r < 0 ? 0 : r > 360 ? 360 : r;
}
function ta(r) {
  return r < 0 ? 0 : r > 1 ? 1 : r;
}
function ul(r) {
  var t = r;
  return t.length && t.charAt(t.length - 1) === "%" ? Ie(parseFloat(t) / 100 * 255) : Ie(parseInt(t, 10));
}
function si(r) {
  var t = r;
  return t.length && t.charAt(t.length - 1) === "%" ? ta(parseFloat(t) / 100) : ta(parseFloat(t));
}
function fl(r, t, e) {
  return e < 0 ? e += 1 : e > 1 && (e -= 1), e * 6 < 1 ? r + (t - r) * e * 6 : e * 2 < 1 ? t : e * 3 < 2 ? r + (t - r) * (2 / 3 - e) * 6 : r;
}
function mr(r, t, e) {
  return r + (t - r) * e;
}
function oe(r, t, e, i, n) {
  return r[0] = t, r[1] = e, r[2] = i, r[3] = n, r;
}
function zu(r, t) {
  return r[0] = t[0], r[1] = t[1], r[2] = t[2], r[3] = t[3], r;
}
var Wg = new xa(20), Va = null;
function wi(r, t) {
  Va && zu(Va, t), Va = Wg.put(r, Va || t.slice());
}
function Kt(r, t) {
  if (r) {
    t = t || [];
    var e = Wg.get(r);
    if (e)
      return zu(t, e);
    r = r + "";
    var i = r.replace(/ /g, "").toLowerCase();
    if (i in Mv)
      return zu(t, Mv[i]), wi(r, t), t;
    var n = i.length;
    if (i.charAt(0) === "#") {
      if (n === 4 || n === 5) {
        var a = parseInt(i.slice(1, 4), 16);
        if (!(a >= 0 && a <= 4095)) {
          oe(t, 0, 0, 0, 1);
          return;
        }
        return oe(t, (a & 3840) >> 4 | (a & 3840) >> 8, a & 240 | (a & 240) >> 4, a & 15 | (a & 15) << 4, n === 5 ? parseInt(i.slice(4), 16) / 15 : 1), wi(r, t), t;
      } else if (n === 7 || n === 9) {
        var a = parseInt(i.slice(1, 7), 16);
        if (!(a >= 0 && a <= 16777215)) {
          oe(t, 0, 0, 0, 1);
          return;
        }
        return oe(t, (a & 16711680) >> 16, (a & 65280) >> 8, a & 255, n === 9 ? parseInt(i.slice(7), 16) / 255 : 1), wi(r, t), t;
      }
      return;
    }
    var o = i.indexOf("("), s = i.indexOf(")");
    if (o !== -1 && s + 1 === n) {
      var l = i.substr(0, o), u = i.substr(o + 1, s - (o + 1)).split(","), f = 1;
      switch (l) {
        case "rgba":
          if (u.length !== 4)
            return u.length === 3 ? oe(t, +u[0], +u[1], +u[2], 1) : oe(t, 0, 0, 0, 1);
          f = si(u.pop());
        case "rgb":
          if (u.length >= 3)
            return oe(t, ul(u[0]), ul(u[1]), ul(u[2]), u.length === 3 ? f : si(u[3])), wi(r, t), t;
          oe(t, 0, 0, 0, 1);
          return;
        case "hsla":
          if (u.length !== 4) {
            oe(t, 0, 0, 0, 1);
            return;
          }
          return u[3] = si(u[3]), Fu(u, t), wi(r, t), t;
        case "hsl":
          if (u.length !== 3) {
            oe(t, 0, 0, 0, 1);
            return;
          }
          return Fu(u, t), wi(r, t), t;
        default:
          return;
      }
    }
    oe(t, 0, 0, 0, 1);
  }
}
function Fu(r, t) {
  var e = (parseFloat(r[0]) % 360 + 360) % 360 / 360, i = si(r[1]), n = si(r[2]), a = n <= 0.5 ? n * (i + 1) : n + i - n * i, o = n * 2 - a;
  return t = t || [], oe(t, Ie(fl(o, a, e + 1 / 3) * 255), Ie(fl(o, a, e) * 255), Ie(fl(o, a, e - 1 / 3) * 255), 1), r.length === 4 && (t[3] = r[3]), t;
}
function V1(r) {
  if (r) {
    var t = r[0] / 255, e = r[1] / 255, i = r[2] / 255, n = Math.min(t, e, i), a = Math.max(t, e, i), o = a - n, s = (a + n) / 2, l, u;
    if (o === 0)
      l = 0, u = 0;
    else {
      s < 0.5 ? u = o / (a + n) : u = o / (2 - a - n);
      var f = ((a - t) / 6 + o / 2) / o, h = ((a - e) / 6 + o / 2) / o, c = ((a - i) / 6 + o / 2) / o;
      t === a ? l = c - h : e === a ? l = 1 / 3 + f - c : i === a && (l = 2 / 3 + h - f), l < 0 && (l += 1), l > 1 && (l -= 1);
    }
    var v = [l * 360, u, s];
    return r[3] != null && v.push(r[3]), v;
  }
}
function Vu(r, t) {
  var e = Kt(r);
  if (e) {
    for (var i = 0; i < 3; i++)
      t < 0 ? e[i] = e[i] * (1 - t) | 0 : e[i] = (255 - e[i]) * t + e[i] | 0, e[i] > 255 ? e[i] = 255 : e[i] < 0 && (e[i] = 0);
    return Le(e, e.length === 4 ? "rgba" : "rgb");
  }
}
function H1(r) {
  var t = Kt(r);
  if (t)
    return ((1 << 24) + (t[0] << 16) + (t[1] << 8) + +t[2]).toString(16).slice(1);
}
function Vn(r, t, e) {
  if (!(!(t && t.length) || !(r >= 0 && r <= 1))) {
    e = e || [];
    var i = r * (t.length - 1), n = Math.floor(i), a = Math.ceil(i), o = t[n], s = t[a], l = i - n;
    return e[0] = Ie(mr(o[0], s[0], l)), e[1] = Ie(mr(o[1], s[1], l)), e[2] = Ie(mr(o[2], s[2], l)), e[3] = ta(mr(o[3], s[3], l)), e;
  }
}
var G1 = Vn;
function ih(r, t, e) {
  if (!(!(t && t.length) || !(r >= 0 && r <= 1))) {
    var i = r * (t.length - 1), n = Math.floor(i), a = Math.ceil(i), o = Kt(t[n]), s = Kt(t[a]), l = i - n, u = Le([
      Ie(mr(o[0], s[0], l)),
      Ie(mr(o[1], s[1], l)),
      Ie(mr(o[2], s[2], l)),
      ta(mr(o[3], s[3], l))
    ], "rgba");
    return e ? {
      color: u,
      leftIndex: n,
      rightIndex: a,
      value: i
    } : u;
  }
}
var W1 = ih;
function Io(r, t, e, i) {
  var n = Kt(r);
  if (r)
    return n = V1(n), t != null && (n[0] = F1(t)), e != null && (n[1] = si(e)), i != null && (n[2] = si(i)), Le(Fu(n), "rgba");
}
function Ug(r, t) {
  var e = Kt(r);
  if (e && t != null)
    return e[3] = ta(t), Le(e, "rgba");
}
function Le(r, t) {
  if (!(!r || !r.length)) {
    var e = r[0] + "," + r[1] + "," + r[2];
    return (t === "rgba" || t === "hsva" || t === "hsla") && (e += "," + r[3]), t + "(" + e + ")";
  }
}
function ea(r, t) {
  var e = Kt(r);
  return e ? (0.299 * e[0] + 0.587 * e[1] + 0.114 * e[2]) * e[3] / 255 + (1 - e[3]) * t : 0;
}
function U1() {
  return Le([
    Math.round(Math.random() * 255),
    Math.round(Math.random() * 255),
    Math.round(Math.random() * 255)
  ], "rgb");
}
var Dv = new xa(100);
function Hu(r) {
  if (V(r)) {
    var t = Dv.get(r);
    return t || (t = Vu(r, -0.1), Dv.put(r, t)), t;
  } else if (_a(r)) {
    var e = k({}, r);
    return e.colorStops = z(r.colorStops, function(i) {
      return {
        offset: i.offset,
        color: Vu(i.color, -0.1)
      };
    }), e;
  }
  return r;
}
const Y1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  fastLerp: Vn,
  fastMapToColor: G1,
  lerp: ih,
  lift: Vu,
  liftColor: Hu,
  lum: ea,
  mapToColor: W1,
  modifyAlpha: Ug,
  modifyHSL: Io,
  parse: Kt,
  random: U1,
  stringify: Le,
  toHex: H1
}, Symbol.toStringTag, { value: "Module" }));
function X1(r) {
  return r.type === "linear";
}
function $1(r) {
  return r.type === "radial";
}
(function() {
  return Y.hasGlobalWindow && X(window.btoa) ? function(r) {
    return window.btoa(unescape(encodeURIComponent(r)));
  } : typeof Buffer < "u" ? function(r) {
    return Buffer.from(r).toString("base64");
  } : function(r) {
    return null;
  };
})();
var Gu = Array.prototype.slice;
function Je(r, t, e) {
  return (t - r) * e + r;
}
function hl(r, t, e, i) {
  for (var n = t.length, a = 0; a < n; a++)
    r[a] = Je(t[a], e[a], i);
  return r;
}
function Z1(r, t, e, i) {
  for (var n = t.length, a = n && t[0].length, o = 0; o < n; o++) {
    r[o] || (r[o] = []);
    for (var s = 0; s < a; s++)
      r[o][s] = Je(t[o][s], e[o][s], i);
  }
  return r;
}
function Ha(r, t, e, i) {
  for (var n = t.length, a = 0; a < n; a++)
    r[a] = t[a] + e[a] * i;
  return r;
}
function Av(r, t, e, i) {
  for (var n = t.length, a = n && t[0].length, o = 0; o < n; o++) {
    r[o] || (r[o] = []);
    for (var s = 0; s < a; s++)
      r[o][s] = t[o][s] + e[o][s] * i;
  }
  return r;
}
function q1(r, t) {
  for (var e = r.length, i = t.length, n = e > i ? t : r, a = Math.min(e, i), o = n[a - 1] || { color: [0, 0, 0, 0], offset: 0 }, s = a; s < Math.max(e, i); s++)
    n.push({
      offset: o.offset,
      color: o.color.slice()
    });
}
function K1(r, t, e) {
  var i = r, n = t;
  if (!(!i.push || !n.push)) {
    var a = i.length, o = n.length;
    if (a !== o) {
      var s = a > o;
      if (s)
        i.length = o;
      else
        for (var l = a; l < o; l++)
          i.push(e === 1 ? n[l] : Gu.call(n[l]));
    }
    for (var u = i[0] && i[0].length, l = 0; l < i.length; l++)
      if (e === 1)
        isNaN(i[l]) && (i[l] = n[l]);
      else
        for (var f = 0; f < u; f++)
          isNaN(i[l][f]) && (i[l][f] = n[l][f]);
  }
}
function Lo(r) {
  if (Ht(r)) {
    var t = r.length;
    if (Ht(r[0])) {
      for (var e = [], i = 0; i < t; i++)
        e.push(Gu.call(r[i]));
      return e;
    }
    return Gu.call(r);
  }
  return r;
}
function Po(r) {
  return r[0] = Math.floor(r[0]) || 0, r[1] = Math.floor(r[1]) || 0, r[2] = Math.floor(r[2]) || 0, r[3] = r[3] == null ? 1 : r[3], "rgba(" + r.join(",") + ")";
}
function Q1(r) {
  return Ht(r && r[0]) ? 2 : 1;
}
var Ga = 0, Ro = 1, Yg = 2, Rn = 3, Wu = 4, Uu = 5, Iv = 6;
function Lv(r) {
  return r === Wu || r === Uu;
}
function Wa(r) {
  return r === Ro || r === Yg;
}
var pn = [0, 0, 0, 0], J1 = (function() {
  function r(t) {
    this.keyframes = [], this.discrete = !1, this._invalid = !1, this._needsSort = !1, this._lastFr = 0, this._lastFrP = 0, this.propName = t;
  }
  return r.prototype.isFinished = function() {
    return this._finished;
  }, r.prototype.setFinished = function() {
    this._finished = !0, this._additiveTrack && this._additiveTrack.setFinished();
  }, r.prototype.needsAnimate = function() {
    return this.keyframes.length >= 1;
  }, r.prototype.getAdditiveTrack = function() {
    return this._additiveTrack;
  }, r.prototype.addKeyframe = function(t, e, i) {
    this._needsSort = !0;
    var n = this.keyframes, a = n.length, o = !1, s = Iv, l = e;
    if (Ht(e)) {
      var u = Q1(e);
      s = u, (u === 1 && !vt(e[0]) || u === 2 && !vt(e[0][0])) && (o = !0);
    } else if (vt(e) && !Jn(e))
      s = Ga;
    else if (V(e))
      if (!isNaN(+e))
        s = Ga;
      else {
        var f = Kt(e);
        f && (l = f, s = Rn);
      }
    else if (_a(e)) {
      var h = k({}, l);
      h.colorStops = z(e.colorStops, function(v) {
        return {
          offset: v.offset,
          color: Kt(v.color)
        };
      }), X1(e) ? s = Wu : $1(e) && (s = Uu), l = h;
    }
    a === 0 ? this.valType = s : (s !== this.valType || s === Iv) && (o = !0), this.discrete = this.discrete || o;
    var c = {
      time: t,
      value: l,
      rawValue: e,
      percent: 0
    };
    return i && (c.easing = i, c.easingFunc = X(i) ? i : Fn[i] || Hg(i)), n.push(c), c;
  }, r.prototype.prepare = function(t, e) {
    var i = this.keyframes;
    this._needsSort && i.sort(function(g, d) {
      return g.time - d.time;
    });
    for (var n = this.valType, a = i.length, o = i[a - 1], s = this.discrete, l = Wa(n), u = Lv(n), f = 0; f < a; f++) {
      var h = i[f], c = h.value, v = o.value;
      h.percent = h.time / t, s || (l && f !== a - 1 ? K1(c, v, n) : u && q1(c.colorStops, v.colorStops));
    }
    if (!s && n !== Uu && e && this.needsAnimate() && e.needsAnimate() && n === e.valType && !e._finished) {
      this._additiveTrack = e;
      for (var p = i[0].value, f = 0; f < a; f++)
        n === Ga ? i[f].additiveValue = i[f].value - p : n === Rn ? i[f].additiveValue = Ha([], i[f].value, p, -1) : Wa(n) && (i[f].additiveValue = n === Ro ? Ha([], i[f].value, p, -1) : Av([], i[f].value, p, -1));
    }
  }, r.prototype.step = function(t, e) {
    if (!this._finished) {
      this._additiveTrack && this._additiveTrack._finished && (this._additiveTrack = null);
      var i = this._additiveTrack != null, n = i ? "additiveValue" : "value", a = this.valType, o = this.keyframes, s = o.length, l = this.propName, u = a === Rn, f, h = this._lastFr, c = Math.min, v, p;
      if (s === 1)
        v = p = o[0];
      else {
        if (e < 0)
          f = 0;
        else if (e < this._lastFrP) {
          var g = c(h + 1, s - 1);
          for (f = g; f >= 0 && !(o[f].percent <= e); f--)
            ;
          f = c(f, s - 2);
        } else {
          for (f = h; f < s && !(o[f].percent > e); f++)
            ;
          f = c(f - 1, s - 2);
        }
        p = o[f + 1], v = o[f];
      }
      if (v && p) {
        this._lastFr = f, this._lastFrP = e;
        var d = p.percent - v.percent, y = d === 0 ? 1 : c((e - v.percent) / d, 1);
        p.easingFunc && (y = p.easingFunc(y));
        var m = i ? this._additiveValue : u ? pn : t[l];
        if ((Wa(a) || u) && !m && (m = this._additiveValue = []), this.discrete)
          t[l] = y < 1 ? v.rawValue : p.rawValue;
        else if (Wa(a))
          a === Ro ? hl(m, v[n], p[n], y) : Z1(m, v[n], p[n], y);
        else if (Lv(a)) {
          var _ = v[n], S = p[n], w = a === Wu;
          t[l] = {
            type: w ? "linear" : "radial",
            x: Je(_.x, S.x, y),
            y: Je(_.y, S.y, y),
            colorStops: z(_.colorStops, function(x, M) {
              var D = S.colorStops[M];
              return {
                offset: Je(x.offset, D.offset, y),
                color: Po(hl([], x.color, D.color, y))
              };
            }),
            global: S.global
          }, w ? (t[l].x2 = Je(_.x2, S.x2, y), t[l].y2 = Je(_.y2, S.y2, y)) : t[l].r = Je(_.r, S.r, y);
        } else if (u)
          hl(m, v[n], p[n], y), i || (t[l] = Po(m));
        else {
          var b = Je(v[n], p[n], y);
          i ? this._additiveValue = b : t[l] = b;
        }
        i && this._addToTarget(t);
      }
    }
  }, r.prototype._addToTarget = function(t) {
    var e = this.valType, i = this.propName, n = this._additiveValue;
    e === Ga ? t[i] = t[i] + n : e === Rn ? (Kt(t[i], pn), Ha(pn, pn, n, 1), t[i] = Po(pn)) : e === Ro ? Ha(t[i], t[i], n, 1) : e === Yg && Av(t[i], t[i], n, 1);
  }, r;
})(), nh = (function() {
  function r(t, e, i, n) {
    if (this._tracks = {}, this._trackKeys = [], this._maxTime = 0, this._started = 0, this._clip = null, this._target = t, this._loop = e, e && n) {
      _s("Can' use additive animation on looped animation.");
      return;
    }
    this._additiveAnimators = n, this._allowDiscrete = i;
  }
  return r.prototype.getMaxTime = function() {
    return this._maxTime;
  }, r.prototype.getDelay = function() {
    return this._delay;
  }, r.prototype.getLoop = function() {
    return this._loop;
  }, r.prototype.getTarget = function() {
    return this._target;
  }, r.prototype.changeTarget = function(t) {
    this._target = t;
  }, r.prototype.when = function(t, e, i) {
    return this.whenWithKeys(t, e, ct(e), i);
  }, r.prototype.whenWithKeys = function(t, e, i, n) {
    for (var a = this._tracks, o = 0; o < i.length; o++) {
      var s = i[o], l = a[s];
      if (!l) {
        l = a[s] = new J1(s);
        var u = void 0, f = this._getAdditiveTrack(s);
        if (f) {
          var h = f.keyframes, c = h[h.length - 1];
          u = c && c.value, f.valType === Rn && u && (u = Po(u));
        } else
          u = this._target[s];
        if (u == null)
          continue;
        t > 0 && l.addKeyframe(0, Lo(u), n), this._trackKeys.push(s);
      }
      l.addKeyframe(t, Lo(e[s]), n);
    }
    return this._maxTime = Math.max(this._maxTime, t), this;
  }, r.prototype.pause = function() {
    this._clip.pause(), this._paused = !0;
  }, r.prototype.resume = function() {
    this._clip.resume(), this._paused = !1;
  }, r.prototype.isPaused = function() {
    return !!this._paused;
  }, r.prototype.duration = function(t) {
    return this._maxTime = t, this._force = !0, this;
  }, r.prototype._doneCallback = function() {
    this._setTracksFinished(), this._clip = null;
    var t = this._doneCbs;
    if (t)
      for (var e = t.length, i = 0; i < e; i++)
        t[i].call(this);
  }, r.prototype._abortedCallback = function() {
    this._setTracksFinished();
    var t = this.animation, e = this._abortedCbs;
    if (t && t.removeClip(this._clip), this._clip = null, e)
      for (var i = 0; i < e.length; i++)
        e[i].call(this);
  }, r.prototype._setTracksFinished = function() {
    for (var t = this._tracks, e = this._trackKeys, i = 0; i < e.length; i++)
      t[e[i]].setFinished();
  }, r.prototype._getAdditiveTrack = function(t) {
    var e, i = this._additiveAnimators;
    if (i)
      for (var n = 0; n < i.length; n++) {
        var a = i[n].getTrack(t);
        a && (e = a);
      }
    return e;
  }, r.prototype.start = function(t) {
    if (!(this._started > 0)) {
      this._started = 1;
      for (var e = this, i = [], n = this._maxTime || 0, a = 0; a < this._trackKeys.length; a++) {
        var o = this._trackKeys[a], s = this._tracks[o], l = this._getAdditiveTrack(o), u = s.keyframes, f = u.length;
        if (s.prepare(n, l), s.needsAnimate())
          if (!this._allowDiscrete && s.discrete) {
            var h = u[f - 1];
            h && (e._target[s.propName] = h.rawValue), s.setFinished();
          } else
            i.push(s);
      }
      if (i.length || this._force) {
        var c = new B1({
          life: n,
          loop: this._loop,
          delay: this._delay || 0,
          onframe: function(v) {
            e._started = 2;
            var p = e._additiveAnimators;
            if (p) {
              for (var g = !1, d = 0; d < p.length; d++)
                if (p[d]._clip) {
                  g = !0;
                  break;
                }
              g || (e._additiveAnimators = null);
            }
            for (var d = 0; d < i.length; d++)
              i[d].step(e._target, v);
            var y = e._onframeCbs;
            if (y)
              for (var d = 0; d < y.length; d++)
                y[d](e._target, v);
          },
          ondestroy: function() {
            e._doneCallback();
          }
        });
        this._clip = c, this.animation && this.animation.addClip(c), t && c.setEasing(t);
      } else
        this._doneCallback();
      return this;
    }
  }, r.prototype.stop = function(t) {
    if (this._clip) {
      var e = this._clip;
      t && e.onframe(1), this._abortedCallback();
    }
  }, r.prototype.delay = function(t) {
    return this._delay = t, this;
  }, r.prototype.during = function(t) {
    return t && (this._onframeCbs || (this._onframeCbs = []), this._onframeCbs.push(t)), this;
  }, r.prototype.done = function(t) {
    return t && (this._doneCbs || (this._doneCbs = []), this._doneCbs.push(t)), this;
  }, r.prototype.aborted = function(t) {
    return t && (this._abortedCbs || (this._abortedCbs = []), this._abortedCbs.push(t)), this;
  }, r.prototype.getClip = function() {
    return this._clip;
  }, r.prototype.getTrack = function(t) {
    return this._tracks[t];
  }, r.prototype.getTracks = function() {
    var t = this;
    return z(this._trackKeys, function(e) {
      return t._tracks[e];
    });
  }, r.prototype.stopTracks = function(t, e) {
    if (!t.length || !this._clip)
      return !0;
    for (var i = this._tracks, n = this._trackKeys, a = 0; a < t.length; a++) {
      var o = i[t[a]];
      o && !o.isFinished() && (e ? o.step(this._target, 1) : this._started === 1 && o.step(this._target, 0), o.setFinished());
    }
    for (var s = !0, a = 0; a < n.length; a++)
      if (!i[n[a]].isFinished()) {
        s = !1;
        break;
      }
    return s && this._abortedCallback(), s;
  }, r.prototype.saveTo = function(t, e, i) {
    if (t) {
      e = e || this._trackKeys;
      for (var n = 0; n < e.length; n++) {
        var a = e[n], o = this._tracks[a];
        if (!(!o || o.isFinished())) {
          var s = o.keyframes, l = s[i ? 0 : s.length - 1];
          l && (t[a] = Lo(l.rawValue));
        }
      }
    }
  }, r.prototype.__changeFinalValue = function(t, e) {
    e = e || ct(t);
    for (var i = 0; i < e.length; i++) {
      var n = e[i], a = this._tracks[n];
      if (a) {
        var o = a.keyframes;
        if (o.length > 1) {
          var s = o.pop();
          a.addKeyframe(s.time, t[n]), a.prepare(this._maxTime, a.getAdditiveTrack());
        }
      }
    }
  }, r;
})();
function Vi() {
  return (/* @__PURE__ */ new Date()).getTime();
}
var j1 = (function(r) {
  ut(t, r);
  function t(e) {
    var i = r.call(this) || this;
    return i._running = !1, i._time = 0, i._pausedTime = 0, i._pauseStart = 0, i._paused = !1, e = e || {}, i.stage = e.stage || {}, i;
  }
  return t.prototype.addClip = function(e) {
    e.animation && this.removeClip(e), this._head ? (this._tail.next = e, e.prev = this._tail, e.next = null, this._tail = e) : this._head = this._tail = e, e.animation = this;
  }, t.prototype.addAnimator = function(e) {
    e.animation = this;
    var i = e.getClip();
    i && this.addClip(i);
  }, t.prototype.removeClip = function(e) {
    if (e.animation) {
      var i = e.prev, n = e.next;
      i ? i.next = n : this._head = n, n ? n.prev = i : this._tail = i, e.next = e.prev = e.animation = null;
    }
  }, t.prototype.removeAnimator = function(e) {
    var i = e.getClip();
    i && this.removeClip(i), e.animation = null;
  }, t.prototype.update = function(e) {
    for (var i = Vi() - this._pausedTime, n = i - this._time, a = this._head; a; ) {
      var o = a.next, s = a.step(i, n);
      s && (a.ondestroy(), this.removeClip(a)), a = o;
    }
    this._time = i, e || (this.trigger("frame", n), this.stage.update && this.stage.update());
  }, t.prototype._startLoop = function() {
    var e = this;
    this._running = !0;
    function i() {
      e._running && (Xo(i), !e._paused && e.update());
    }
    Xo(i);
  }, t.prototype.start = function() {
    this._running || (this._time = Vi(), this._pausedTime = 0, this._startLoop());
  }, t.prototype.stop = function() {
    this._running = !1;
  }, t.prototype.pause = function() {
    this._paused || (this._pauseStart = Vi(), this._paused = !0);
  }, t.prototype.resume = function() {
    this._paused && (this._pausedTime += Vi() - this._pauseStart, this._paused = !1);
  }, t.prototype.clear = function() {
    for (var e = this._head; e; ) {
      var i = e.next;
      e.prev = e.next = e.animation = null, e = i;
    }
    this._head = this._tail = null;
  }, t.prototype.isFinished = function() {
    return this._head == null;
  }, t.prototype.animate = function(e, i) {
    i = i || {}, this.start();
    var n = new nh(e, i.loop);
    return this.addAnimator(n), n;
  }, t;
})($e), tS = 300, vl = Y.domSupported, cl = (function() {
  var r = [
    "click",
    "dblclick",
    "mousewheel",
    "wheel",
    "mouseout",
    "mouseup",
    "mousedown",
    "mousemove",
    "contextmenu"
  ], t = [
    "touchstart",
    "touchend",
    "touchmove"
  ], e = {
    pointerdown: 1,
    pointerup: 1,
    pointermove: 1,
    pointerout: 1
  }, i = z(r, function(n) {
    var a = n.replace("mouse", "pointer");
    return e.hasOwnProperty(a) ? a : n;
  });
  return {
    mouse: r,
    touch: t,
    pointer: i
  };
})(), Pv = {
  mouse: ["mousemove", "mouseup"],
  pointer: ["pointermove", "pointerup"]
}, Rv = !1;
function Yu(r) {
  var t = r.pointerType;
  return t === "pen" || t === "touch";
}
function eS(r) {
  r.touching = !0, r.touchTimer != null && (clearTimeout(r.touchTimer), r.touchTimer = null), r.touchTimer = setTimeout(function() {
    r.touching = !1, r.touchTimer = null;
  }, 700);
}
function pl(r) {
  r && (r.zrByTouch = !0);
}
function rS(r, t) {
  return se(r.dom, new iS(r, t), !0);
}
function Xg(r, t) {
  for (var e = t, i = !1; e && e.nodeType !== 9 && !(i = e.domBelongToZr || e !== t && e === r.painterRoot); )
    e = e.parentNode;
  return i;
}
var iS = /* @__PURE__ */ (function() {
  function r(t, e) {
    this.stopPropagation = Rt, this.stopImmediatePropagation = Rt, this.preventDefault = Rt, this.type = e.type, this.target = this.currentTarget = t.dom, this.pointerType = e.pointerType, this.clientX = e.clientX, this.clientY = e.clientY;
  }
  return r;
})(), Te = {
  mousedown: function(r) {
    r = se(this.dom, r), this.__mayPointerCapture = [r.zrX, r.zrY], this.trigger("mousedown", r);
  },
  mousemove: function(r) {
    r = se(this.dom, r);
    var t = this.__mayPointerCapture;
    t && (r.zrX !== t[0] || r.zrY !== t[1]) && this.__togglePointerCapture(!0), this.trigger("mousemove", r);
  },
  mouseup: function(r) {
    r = se(this.dom, r), this.__togglePointerCapture(!1), this.trigger("mouseup", r);
  },
  mouseout: function(r) {
    r = se(this.dom, r);
    var t = r.toElement || r.relatedTarget;
    Xg(this, t) || (this.__pointerCapturing && (r.zrEventControl = "no_globalout"), this.trigger("mouseout", r));
  },
  wheel: function(r) {
    Rv = !0, r = se(this.dom, r), this.trigger("mousewheel", r);
  },
  mousewheel: function(r) {
    Rv || (r = se(this.dom, r), this.trigger("mousewheel", r));
  },
  touchstart: function(r) {
    r = se(this.dom, r), pl(r), this.__lastTouchMoment = /* @__PURE__ */ new Date(), this.handler.processGesture(r, "start"), Te.mousemove.call(this, r), Te.mousedown.call(this, r);
  },
  touchmove: function(r) {
    r = se(this.dom, r), pl(r), this.handler.processGesture(r, "change"), Te.mousemove.call(this, r);
  },
  touchend: function(r) {
    r = se(this.dom, r), pl(r), this.handler.processGesture(r, "end"), Te.mouseup.call(this, r), +/* @__PURE__ */ new Date() - +this.__lastTouchMoment < tS && Te.click.call(this, r);
  },
  pointerdown: function(r) {
    Te.mousedown.call(this, r);
  },
  pointermove: function(r) {
    Yu(r) || Te.mousemove.call(this, r);
  },
  pointerup: function(r) {
    Te.mouseup.call(this, r);
  },
  pointerout: function(r) {
    Yu(r) || Te.mouseout.call(this, r);
  }
};
T(["click", "dblclick", "contextmenu"], function(r) {
  Te[r] = function(t) {
    t = se(this.dom, t), this.trigger(r, t);
  };
});
var Xu = {
  pointermove: function(r) {
    Yu(r) || Xu.mousemove.call(this, r);
  },
  pointerup: function(r) {
    Xu.mouseup.call(this, r);
  },
  mousemove: function(r) {
    this.trigger("mousemove", r);
  },
  mouseup: function(r) {
    var t = this.__pointerCapturing;
    this.__togglePointerCapture(!1), this.trigger("mouseup", r), t && (r.zrEventControl = "only_globalout", this.trigger("mouseout", r));
  }
};
function nS(r, t) {
  var e = t.domHandlers;
  Y.pointerEventsSupported ? T(cl.pointer, function(i) {
    Eo(t, i, function(n) {
      e[i].call(r, n);
    });
  }) : (Y.touchEventsSupported && T(cl.touch, function(i) {
    Eo(t, i, function(n) {
      e[i].call(r, n), eS(t);
    });
  }), T(cl.mouse, function(i) {
    Eo(t, i, function(n) {
      n = eh(n), t.touching || e[i].call(r, n);
    });
  }));
}
function aS(r, t) {
  Y.pointerEventsSupported ? T(Pv.pointer, e) : Y.touchEventsSupported || T(Pv.mouse, e);
  function e(i) {
    function n(a) {
      a = eh(a), Xg(r, a.target) || (a = rS(r, a), t.domHandlers[i].call(r, a));
    }
    Eo(t, i, n, { capture: !0 });
  }
}
function Eo(r, t, e, i) {
  r.mounted[t] = e, r.listenerOpts[t] = i, g1(r.domTarget, t, e, i);
}
function dl(r) {
  var t = r.mounted;
  for (var e in t)
    t.hasOwnProperty(e) && y1(r.domTarget, e, t[e], r.listenerOpts[e]);
  r.mounted = {};
}
var Ev = /* @__PURE__ */ (function() {
  function r(t, e) {
    this.mounted = {}, this.listenerOpts = {}, this.touching = !1, this.domTarget = t, this.domHandlers = e;
  }
  return r;
})(), oS = (function(r) {
  ut(t, r);
  function t(e, i) {
    var n = r.call(this) || this;
    return n.__pointerCapturing = !1, n.dom = e, n.painterRoot = i, n._localHandlerScope = new Ev(e, Te), vl && (n._globalHandlerScope = new Ev(document, Xu)), nS(n, n._localHandlerScope), n;
  }
  return t.prototype.dispose = function() {
    dl(this._localHandlerScope), vl && dl(this._globalHandlerScope);
  }, t.prototype.setCursor = function(e) {
    this.dom.style && (this.dom.style.cursor = e || "default");
  }, t.prototype.__togglePointerCapture = function(e) {
    if (this.__mayPointerCapture = null, vl && +this.__pointerCapturing ^ +e) {
      this.__pointerCapturing = e;
      var i = this._globalHandlerScope;
      e ? aS(this, i) : dl(i);
    }
  }, t;
})($e), $g = 1;
Y.hasGlobalWindow && ($g = Math.max(window.devicePixelRatio || window.screen && window.screen.deviceXDPI / window.screen.logicalXDPI || 1, 1));
var Qo = $g, $u = 0.4, Zu = "#333", qu = "#ccc", sS = "#eee", Ov = ba, kv = 5e-5;
function Br(r) {
  return r > kv || r < -kv;
}
var zr = [], xi = [], gl = Sr(), yl = Math.abs, ah = (function() {
  function r() {
  }
  return r.prototype.getLocalTransform = function(t) {
    return r.getLocalTransform(this, t);
  }, r.prototype.setPosition = function(t) {
    this.x = t[0], this.y = t[1];
  }, r.prototype.setScale = function(t) {
    this.scaleX = t[0], this.scaleY = t[1];
  }, r.prototype.setSkew = function(t) {
    this.skewX = t[0], this.skewY = t[1];
  }, r.prototype.setOrigin = function(t) {
    this.originX = t[0], this.originY = t[1];
  }, r.prototype.needLocalTransform = function() {
    return Br(this.rotation) || Br(this.x) || Br(this.y) || Br(this.scaleX - 1) || Br(this.scaleY - 1) || Br(this.skewX) || Br(this.skewY);
  }, r.prototype.updateTransform = function() {
    var t = this.parent && this.parent.transform, e = this.needLocalTransform(), i = this.transform;
    if (!(e || t)) {
      i && (Ov(i), this.invTransform = null);
      return;
    }
    i = i || Sr(), e ? this.getLocalTransform(i) : Ov(i), t && (e ? br(i, t, i) : rh(i, t)), this.transform = i, this._resolveGlobalScaleRatio(i);
  }, r.prototype._resolveGlobalScaleRatio = function(t) {
    var e = this.globalScaleRatio;
    if (e != null && e !== 1) {
      this.getGlobalScale(zr);
      var i = zr[0] < 0 ? -1 : 1, n = zr[1] < 0 ? -1 : 1, a = ((zr[0] - i) * e + i) / zr[0] || 0, o = ((zr[1] - n) * e + n) / zr[1] || 0;
      t[0] *= a, t[1] *= a, t[2] *= o, t[3] *= o;
    }
    this.invTransform = this.invTransform || Sr(), wa(this.invTransform, t);
  }, r.prototype.getComputedTransform = function() {
    for (var t = this, e = []; t; )
      e.push(t), t = t.parent;
    for (; t = e.pop(); )
      t.updateTransform();
    return this.transform;
  }, r.prototype.setLocalTransform = function(t) {
    if (t) {
      var e = t[0] * t[0] + t[1] * t[1], i = t[2] * t[2] + t[3] * t[3], n = Math.atan2(t[1], t[0]), a = Math.PI / 2 + n - Math.atan2(t[3], t[2]);
      i = Math.sqrt(i) * Math.cos(a), e = Math.sqrt(e), this.skewX = a, this.skewY = 0, this.rotation = -n, this.x = +t[4], this.y = +t[5], this.scaleX = e, this.scaleY = i, this.originX = 0, this.originY = 0;
    }
  }, r.prototype.decomposeTransform = function() {
    if (this.transform) {
      var t = this.parent, e = this.transform;
      t && t.transform && (t.invTransform = t.invTransform || Sr(), br(xi, t.invTransform, e), e = xi);
      var i = this.originX, n = this.originY;
      (i || n) && (gl[4] = i, gl[5] = n, br(xi, e, gl), xi[4] -= i, xi[5] -= n, e = xi), this.setLocalTransform(e);
    }
  }, r.prototype.getGlobalScale = function(t) {
    var e = this.transform;
    return t = t || [], e ? (t[0] = Math.sqrt(e[0] * e[0] + e[1] * e[1]), t[1] = Math.sqrt(e[2] * e[2] + e[3] * e[3]), e[0] < 0 && (t[0] = -t[0]), e[3] < 0 && (t[1] = -t[1]), t) : (t[0] = 1, t[1] = 1, t);
  }, r.prototype.transformCoordToLocal = function(t, e) {
    var i = [t, e], n = this.invTransform;
    return n && Vt(i, i, n), i;
  }, r.prototype.transformCoordToGlobal = function(t, e) {
    var i = [t, e], n = this.transform;
    return n && Vt(i, i, n), i;
  }, r.prototype.getLineScale = function() {
    var t = this.transform;
    return t && yl(t[0] - 1) > 1e-10 && yl(t[3] - 1) > 1e-10 ? Math.sqrt(yl(t[0] * t[3] - t[2] * t[1])) : 1;
  }, r.prototype.copyTransform = function(t) {
    lS(this, t);
  }, r.getLocalTransform = function(t, e) {
    e = e || [];
    var i = t.originX || 0, n = t.originY || 0, a = t.scaleX, o = t.scaleY, s = t.anchorX, l = t.anchorY, u = t.rotation || 0, f = t.x, h = t.y, c = t.skewX ? Math.tan(t.skewX) : 0, v = t.skewY ? Math.tan(-t.skewY) : 0;
    if (i || n || s || l) {
      var p = i + s, g = n + l;
      e[4] = -p * a - c * g * o, e[5] = -g * o - v * p * a;
    } else
      e[4] = e[5] = 0;
    return e[0] = a, e[3] = o, e[1] = v * a, e[2] = c * o, u && ws(e, e, u), e[4] += i + f, e[5] += n + h, e;
  }, r.initDefaultProps = (function() {
    var t = r.prototype;
    t.scaleX = t.scaleY = t.globalScaleRatio = 1, t.x = t.y = t.originX = t.originY = t.skewX = t.skewY = t.rotation = t.anchorX = t.anchorY = 0;
  })(), r;
})(), ra = [
  "x",
  "y",
  "originX",
  "originY",
  "anchorX",
  "anchorY",
  "rotation",
  "scaleX",
  "scaleY",
  "skewX",
  "skewY"
];
function lS(r, t) {
  for (var e = 0; e < ra.length; e++) {
    var i = ra[e];
    r[i] = t[i];
  }
}
var Nv = {};
function ee(r, t) {
  t = t || vi;
  var e = Nv[t];
  e || (e = Nv[t] = new xa(500));
  var i = e.get(r);
  return i == null && (i = Re.measureText(r, t).width, e.put(r, i)), i;
}
function Bv(r, t, e, i) {
  var n = ee(r, t), a = sh(t), o = En(0, n, e), s = Fi(0, a, i), l = new it(o, s, n, a);
  return l;
}
function oh(r, t, e, i) {
  var n = ((r || "") + "").split(`
`), a = n.length;
  if (a === 1)
    return Bv(n[0], t, e, i);
  for (var o = new it(0, 0, 0, 0), s = 0; s < n.length; s++) {
    var l = Bv(n[s], t, e, i);
    s === 0 ? o.copy(l) : o.union(l);
  }
  return o;
}
function En(r, t, e) {
  return e === "right" ? r -= t : e === "center" && (r -= t / 2), r;
}
function Fi(r, t, e) {
  return e === "middle" ? r -= t / 2 : e === "bottom" && (r -= t), r;
}
function sh(r) {
  return ee("国", r);
}
function Ue(r, t) {
  return typeof r == "string" ? r.lastIndexOf("%") >= 0 ? parseFloat(r) / 100 * t : parseFloat(r) : r;
}
function Jo(r, t, e) {
  var i = t.position || "inside", n = t.distance != null ? t.distance : 5, a = e.height, o = e.width, s = a / 2, l = e.x, u = e.y, f = "left", h = "top";
  if (i instanceof Array)
    l += Ue(i[0], e.width), u += Ue(i[1], e.height), f = null, h = null;
  else
    switch (i) {
      case "left":
        l -= n, u += s, f = "right", h = "middle";
        break;
      case "right":
        l += n + o, u += s, h = "middle";
        break;
      case "top":
        l += o / 2, u -= n, f = "center", h = "bottom";
        break;
      case "bottom":
        l += o / 2, u += a + n, f = "center";
        break;
      case "inside":
        l += o / 2, u += s, f = "center", h = "middle";
        break;
      case "insideLeft":
        l += n, u += s, h = "middle";
        break;
      case "insideRight":
        l += o - n, u += s, f = "right", h = "middle";
        break;
      case "insideTop":
        l += o / 2, u += n, f = "center";
        break;
      case "insideBottom":
        l += o / 2, u += a - n, f = "center", h = "bottom";
        break;
      case "insideTopLeft":
        l += n, u += n;
        break;
      case "insideTopRight":
        l += o - n, u += n, f = "right";
        break;
      case "insideBottomLeft":
        l += n, u += a - n, h = "bottom";
        break;
      case "insideBottomRight":
        l += o - n, u += a - n, f = "right", h = "bottom";
        break;
    }
  return r = r || {}, r.x = l, r.y = u, r.align = f, r.verticalAlign = h, r;
}
var ml = "__zr_normal__", _l = ra.concat(["ignore"]), uS = We(ra, function(r, t) {
  return r[t] = !0, r;
}, { ignore: !1 }), Ti = {}, fS = new it(0, 0, 0, 0), xs = (function() {
  function r(t) {
    this.id = Zf(), this.animators = [], this.currentStates = [], this.states = {}, this._init(t);
  }
  return r.prototype._init = function(t) {
    this.attr(t);
  }, r.prototype.drift = function(t, e, i) {
    switch (this.draggable) {
      case "horizontal":
        e = 0;
        break;
      case "vertical":
        t = 0;
        break;
    }
    var n = this.transform;
    n || (n = this.transform = [1, 0, 0, 1, 0, 0]), n[4] += t, n[5] += e, this.decomposeTransform(), this.markRedraw();
  }, r.prototype.beforeUpdate = function() {
  }, r.prototype.afterUpdate = function() {
  }, r.prototype.update = function() {
    this.updateTransform(), this.__dirty && this.updateInnerText();
  }, r.prototype.updateInnerText = function(t) {
    var e = this._textContent;
    if (e && (!e.ignore || t)) {
      this.textConfig || (this.textConfig = {});
      var i = this.textConfig, n = i.local, a = e.innerTransformable, o = void 0, s = void 0, l = !1;
      a.parent = n ? this : null;
      var u = !1;
      if (a.copyTransform(e), i.position != null) {
        var f = fS;
        i.layoutRect ? f.copy(i.layoutRect) : f.copy(this.getBoundingRect()), n || f.applyTransform(this.transform), this.calculateTextPosition ? this.calculateTextPosition(Ti, i, f) : Jo(Ti, i, f), a.x = Ti.x, a.y = Ti.y, o = Ti.align, s = Ti.verticalAlign;
        var h = i.origin;
        if (h && i.rotation != null) {
          var c = void 0, v = void 0;
          h === "center" ? (c = f.width * 0.5, v = f.height * 0.5) : (c = Ue(h[0], f.width), v = Ue(h[1], f.height)), u = !0, a.originX = -a.x + c + (n ? 0 : f.x), a.originY = -a.y + v + (n ? 0 : f.y);
        }
      }
      i.rotation != null && (a.rotation = i.rotation);
      var p = i.offset;
      p && (a.x += p[0], a.y += p[1], u || (a.originX = -p[0], a.originY = -p[1]));
      var g = i.inside == null ? typeof i.position == "string" && i.position.indexOf("inside") >= 0 : i.inside, d = this._innerTextDefaultStyle || (this._innerTextDefaultStyle = {}), y = void 0, m = void 0, _ = void 0;
      g && this.canBeInsideText() ? (y = i.insideFill, m = i.insideStroke, (y == null || y === "auto") && (y = this.getInsideTextFill()), (m == null || m === "auto") && (m = this.getInsideTextStroke(y), _ = !0)) : (y = i.outsideFill, m = i.outsideStroke, (y == null || y === "auto") && (y = this.getOutsideFill()), (m == null || m === "auto") && (m = this.getOutsideStroke(y), _ = !0)), y = y || "#000", (y !== d.fill || m !== d.stroke || _ !== d.autoStroke || o !== d.align || s !== d.verticalAlign) && (l = !0, d.fill = y, d.stroke = m, d.autoStroke = _, d.align = o, d.verticalAlign = s, e.setDefaultTextStyle(d)), e.__dirty |= te, l && e.dirtyStyle(!0);
    }
  }, r.prototype.canBeInsideText = function() {
    return !0;
  }, r.prototype.getInsideTextFill = function() {
    return "#fff";
  }, r.prototype.getInsideTextStroke = function(t) {
    return "#000";
  }, r.prototype.getOutsideFill = function() {
    return this.__zr && this.__zr.isDarkMode() ? qu : Zu;
  }, r.prototype.getOutsideStroke = function(t) {
    var e = this.__zr && this.__zr.getBackgroundColor(), i = typeof e == "string" && Kt(e);
    i || (i = [255, 255, 255, 1]);
    for (var n = i[3], a = this.__zr.isDarkMode(), o = 0; o < 3; o++)
      i[o] = i[o] * n + (a ? 0 : 255) * (1 - n);
    return i[3] = 1, Le(i, "rgba");
  }, r.prototype.traverse = function(t, e) {
  }, r.prototype.attrKV = function(t, e) {
    t === "textConfig" ? this.setTextConfig(e) : t === "textContent" ? this.setTextContent(e) : t === "clipPath" ? this.setClipPath(e) : t === "extra" ? (this.extra = this.extra || {}, k(this.extra, e)) : this[t] = e;
  }, r.prototype.hide = function() {
    this.ignore = !0, this.markRedraw();
  }, r.prototype.show = function() {
    this.ignore = !1, this.markRedraw();
  }, r.prototype.attr = function(t, e) {
    if (typeof t == "string")
      this.attrKV(t, e);
    else if (H(t))
      for (var i = t, n = ct(i), a = 0; a < n.length; a++) {
        var o = n[a];
        this.attrKV(o, t[o]);
      }
    return this.markRedraw(), this;
  }, r.prototype.saveCurrentToNormalState = function(t) {
    this._innerSaveToNormal(t);
    for (var e = this._normalState, i = 0; i < this.animators.length; i++) {
      var n = this.animators[i], a = n.__fromStateTransition;
      if (!(n.getLoop() || a && a !== ml)) {
        var o = n.targetName, s = o ? e[o] : e;
        n.saveTo(s);
      }
    }
  }, r.prototype._innerSaveToNormal = function(t) {
    var e = this._normalState;
    e || (e = this._normalState = {}), t.textConfig && !e.textConfig && (e.textConfig = this.textConfig), this._savePrimaryToNormal(t, e, _l);
  }, r.prototype._savePrimaryToNormal = function(t, e, i) {
    for (var n = 0; n < i.length; n++) {
      var a = i[n];
      t[a] != null && !(a in e) && (e[a] = this[a]);
    }
  }, r.prototype.hasState = function() {
    return this.currentStates.length > 0;
  }, r.prototype.getState = function(t) {
    return this.states[t];
  }, r.prototype.ensureState = function(t) {
    var e = this.states;
    return e[t] || (e[t] = {}), e[t];
  }, r.prototype.clearStates = function(t) {
    this.useState(ml, !1, t);
  }, r.prototype.useState = function(t, e, i, n) {
    var a = t === ml, o = this.hasState();
    if (!(!o && a)) {
      var s = this.currentStates, l = this.stateTransition;
      if (!(nt(s, t) >= 0 && (e || s.length === 1))) {
        var u;
        if (this.stateProxy && !a && (u = this.stateProxy(t)), u || (u = this.states && this.states[t]), !u && !a) {
          _s("State " + t + " not exists.");
          return;
        }
        a || this.saveCurrentToNormalState(u);
        var f = !!(u && u.hoverLayer || n);
        f && this._toggleHoverLayerFlag(!0), this._applyStateObj(t, u, this._normalState, e, !i && !this.__inHover && l && l.duration > 0, l);
        var h = this._textContent, c = this._textGuide;
        return h && h.useState(t, e, i, f), c && c.useState(t, e, i, f), a ? (this.currentStates = [], this._normalState = {}) : e ? this.currentStates.push(t) : this.currentStates = [t], this._updateAnimationTargets(), this.markRedraw(), !f && this.__inHover && (this._toggleHoverLayerFlag(!1), this.__dirty &= ~te), u;
      }
    }
  }, r.prototype.useStates = function(t, e, i) {
    if (!t.length)
      this.clearStates();
    else {
      var n = [], a = this.currentStates, o = t.length, s = o === a.length;
      if (s) {
        for (var l = 0; l < o; l++)
          if (t[l] !== a[l]) {
            s = !1;
            break;
          }
      }
      if (s)
        return;
      for (var l = 0; l < o; l++) {
        var u = t[l], f = void 0;
        this.stateProxy && (f = this.stateProxy(u, t)), f || (f = this.states[u]), f && n.push(f);
      }
      var h = n[o - 1], c = !!(h && h.hoverLayer || i);
      c && this._toggleHoverLayerFlag(!0);
      var v = this._mergeStates(n), p = this.stateTransition;
      this.saveCurrentToNormalState(v), this._applyStateObj(t.join(","), v, this._normalState, !1, !e && !this.__inHover && p && p.duration > 0, p);
      var g = this._textContent, d = this._textGuide;
      g && g.useStates(t, e, c), d && d.useStates(t, e, c), this._updateAnimationTargets(), this.currentStates = t.slice(), this.markRedraw(), !c && this.__inHover && (this._toggleHoverLayerFlag(!1), this.__dirty &= ~te);
    }
  }, r.prototype.isSilent = function() {
    for (var t = this.silent, e = this.parent; !t && e; ) {
      if (e.silent) {
        t = !0;
        break;
      }
      e = e.parent;
    }
    return t;
  }, r.prototype._updateAnimationTargets = function() {
    for (var t = 0; t < this.animators.length; t++) {
      var e = this.animators[t];
      e.targetName && e.changeTarget(this[e.targetName]);
    }
  }, r.prototype.removeState = function(t) {
    var e = nt(this.currentStates, t);
    if (e >= 0) {
      var i = this.currentStates.slice();
      i.splice(e, 1), this.useStates(i);
    }
  }, r.prototype.replaceState = function(t, e, i) {
    var n = this.currentStates.slice(), a = nt(n, t), o = nt(n, e) >= 0;
    a >= 0 ? o ? n.splice(a, 1) : n[a] = e : i && !o && n.push(e), this.useStates(n);
  }, r.prototype.toggleState = function(t, e) {
    e ? this.useState(t, !0) : this.removeState(t);
  }, r.prototype._mergeStates = function(t) {
    for (var e = {}, i, n = 0; n < t.length; n++) {
      var a = t[n];
      k(e, a), a.textConfig && (i = i || {}, k(i, a.textConfig));
    }
    return i && (e.textConfig = i), e;
  }, r.prototype._applyStateObj = function(t, e, i, n, a, o) {
    var s = !(e && n);
    e && e.textConfig ? (this.textConfig = k({}, n ? this.textConfig : i.textConfig), k(this.textConfig, e.textConfig)) : s && i.textConfig && (this.textConfig = i.textConfig);
    for (var l = {}, u = !1, f = 0; f < _l.length; f++) {
      var h = _l[f], c = a && uS[h];
      e && e[h] != null ? c ? (u = !0, l[h] = e[h]) : this[h] = e[h] : s && i[h] != null && (c ? (u = !0, l[h] = i[h]) : this[h] = i[h]);
    }
    if (!a)
      for (var f = 0; f < this.animators.length; f++) {
        var v = this.animators[f], p = v.targetName;
        v.getLoop() || v.__changeFinalValue(p ? (e || i)[p] : e || i);
      }
    u && this._transitionState(t, l, o);
  }, r.prototype._attachComponent = function(t) {
    if (!(t.__zr && !t.__hostTarget) && t !== this) {
      var e = this.__zr;
      e && t.addSelfToZr(e), t.__zr = e, t.__hostTarget = this;
    }
  }, r.prototype._detachComponent = function(t) {
    t.__zr && t.removeSelfFromZr(t.__zr), t.__zr = null, t.__hostTarget = null;
  }, r.prototype.getClipPath = function() {
    return this._clipPath;
  }, r.prototype.setClipPath = function(t) {
    this._clipPath && this._clipPath !== t && this.removeClipPath(), this._attachComponent(t), this._clipPath = t, this.markRedraw();
  }, r.prototype.removeClipPath = function() {
    var t = this._clipPath;
    t && (this._detachComponent(t), this._clipPath = null, this.markRedraw());
  }, r.prototype.getTextContent = function() {
    return this._textContent;
  }, r.prototype.setTextContent = function(t) {
    var e = this._textContent;
    e !== t && (e && e !== t && this.removeTextContent(), t.innerTransformable = new ah(), this._attachComponent(t), this._textContent = t, this.markRedraw());
  }, r.prototype.setTextConfig = function(t) {
    this.textConfig || (this.textConfig = {}), k(this.textConfig, t), this.markRedraw();
  }, r.prototype.removeTextConfig = function() {
    this.textConfig = null, this.markRedraw();
  }, r.prototype.removeTextContent = function() {
    var t = this._textContent;
    t && (t.innerTransformable = null, this._detachComponent(t), this._textContent = null, this._innerTextDefaultStyle = null, this.markRedraw());
  }, r.prototype.getTextGuideLine = function() {
    return this._textGuide;
  }, r.prototype.setTextGuideLine = function(t) {
    this._textGuide && this._textGuide !== t && this.removeTextGuideLine(), this._attachComponent(t), this._textGuide = t, this.markRedraw();
  }, r.prototype.removeTextGuideLine = function() {
    var t = this._textGuide;
    t && (this._detachComponent(t), this._textGuide = null, this.markRedraw());
  }, r.prototype.markRedraw = function() {
    this.__dirty |= te;
    var t = this.__zr;
    t && (this.__inHover ? t.refreshHover() : t.refresh()), this.__hostTarget && this.__hostTarget.markRedraw();
  }, r.prototype.dirty = function() {
    this.markRedraw();
  }, r.prototype._toggleHoverLayerFlag = function(t) {
    this.__inHover = t;
    var e = this._textContent, i = this._textGuide;
    e && (e.__inHover = t), i && (i.__inHover = t);
  }, r.prototype.addSelfToZr = function(t) {
    if (this.__zr !== t) {
      this.__zr = t;
      var e = this.animators;
      if (e)
        for (var i = 0; i < e.length; i++)
          t.animation.addAnimator(e[i]);
      this._clipPath && this._clipPath.addSelfToZr(t), this._textContent && this._textContent.addSelfToZr(t), this._textGuide && this._textGuide.addSelfToZr(t);
    }
  }, r.prototype.removeSelfFromZr = function(t) {
    if (this.__zr) {
      this.__zr = null;
      var e = this.animators;
      if (e)
        for (var i = 0; i < e.length; i++)
          t.animation.removeAnimator(e[i]);
      this._clipPath && this._clipPath.removeSelfFromZr(t), this._textContent && this._textContent.removeSelfFromZr(t), this._textGuide && this._textGuide.removeSelfFromZr(t);
    }
  }, r.prototype.animate = function(t, e, i) {
    var n = t ? this[t] : this, a = new nh(n, e, i);
    return t && (a.targetName = t), this.addAnimator(a, t), a;
  }, r.prototype.addAnimator = function(t, e) {
    var i = this.__zr, n = this;
    t.during(function() {
      n.updateDuringAnimation(e);
    }).done(function() {
      var a = n.animators, o = nt(a, t);
      o >= 0 && a.splice(o, 1);
    }), this.animators.push(t), i && i.animation.addAnimator(t), i && i.wakeUp();
  }, r.prototype.updateDuringAnimation = function(t) {
    this.markRedraw();
  }, r.prototype.stopAnimation = function(t, e) {
    for (var i = this.animators, n = i.length, a = [], o = 0; o < n; o++) {
      var s = i[o];
      !t || t === s.scope ? s.stop(e) : a.push(s);
    }
    return this.animators = a, this;
  }, r.prototype.animateTo = function(t, e, i) {
    Sl(this, t, e, i);
  }, r.prototype.animateFrom = function(t, e, i) {
    Sl(this, t, e, i, !0);
  }, r.prototype._transitionState = function(t, e, i, n) {
    for (var a = Sl(this, e, i, n), o = 0; o < a.length; o++)
      a[o].__fromStateTransition = t;
  }, r.prototype.getBoundingRect = function() {
    return null;
  }, r.prototype.getPaintRect = function() {
    return null;
  }, r.initDefaultProps = (function() {
    var t = r.prototype;
    t.type = "element", t.name = "", t.ignore = t.silent = t.isGroup = t.draggable = t.dragging = t.ignoreClip = t.__inHover = !1, t.__dirty = te;
    function e(i, n, a, o) {
      Object.defineProperty(t, i, {
        get: function() {
          if (!this[n]) {
            var l = this[n] = [];
            s(this, l);
          }
          return this[n];
        },
        set: function(l) {
          this[a] = l[0], this[o] = l[1], this[n] = l, s(this, l);
        }
      });
      function s(l, u) {
        Object.defineProperty(u, 0, {
          get: function() {
            return l[a];
          },
          set: function(f) {
            l[a] = f;
          }
        }), Object.defineProperty(u, 1, {
          get: function() {
            return l[o];
          },
          set: function(f) {
            l[o] = f;
          }
        });
      }
    }
    Object.defineProperty && (e("position", "_legacyPos", "x", "y"), e("scale", "_legacyScale", "scaleX", "scaleY"), e("origin", "_legacyOrigin", "originX", "originY"));
  })(), r;
})();
ie(xs, $e);
ie(xs, ah);
function Sl(r, t, e, i, n) {
  e = e || {};
  var a = [];
  Zg(r, "", r, t, e, i, a, n);
  var o = a.length, s = !1, l = e.done, u = e.aborted, f = function() {
    s = !0, o--, o <= 0 && (s ? l && l() : u && u());
  }, h = function() {
    o--, o <= 0 && (s ? l && l() : u && u());
  };
  o || l && l(), a.length > 0 && e.during && a[0].during(function(p, g) {
    e.during(g);
  });
  for (var c = 0; c < a.length; c++) {
    var v = a[c];
    f && v.done(f), h && v.aborted(h), e.force && v.duration(e.duration), v.start(e.easing);
  }
  return a;
}
function bl(r, t, e) {
  for (var i = 0; i < e; i++)
    r[i] = t[i];
}
function hS(r) {
  return Ht(r[0]);
}
function vS(r, t, e) {
  if (Ht(t[e]))
    if (Ht(r[e]) || (r[e] = []), Gt(t[e])) {
      var i = t[e].length;
      r[e].length !== i && (r[e] = new t[e].constructor(i), bl(r[e], t[e], i));
    } else {
      var n = t[e], a = r[e], o = n.length;
      if (hS(n))
        for (var s = n[0].length, l = 0; l < o; l++)
          a[l] ? bl(a[l], n[l], s) : a[l] = Array.prototype.slice.call(n[l]);
      else
        bl(a, n, o);
      a.length = n.length;
    }
  else
    r[e] = t[e];
}
function cS(r, t) {
  return r === t || Ht(r) && Ht(t) && pS(r, t);
}
function pS(r, t) {
  var e = r.length;
  if (e !== t.length)
    return !1;
  for (var i = 0; i < e; i++)
    if (r[i] !== t[i])
      return !1;
  return !0;
}
function Zg(r, t, e, i, n, a, o, s) {
  for (var l = ct(i), u = n.duration, f = n.delay, h = n.additive, c = n.setToFinal, v = !H(a), p = r.animators, g = [], d = 0; d < l.length; d++) {
    var y = l[d], m = i[y];
    if (m != null && e[y] != null && (v || a[y]))
      if (H(m) && !Ht(m) && !_a(m)) {
        if (t) {
          s || (e[y] = m, r.updateDuringAnimation(t));
          continue;
        }
        Zg(r, y, e[y], m, n, a && a[y], o, s);
      } else
        g.push(y);
    else s || (e[y] = m, r.updateDuringAnimation(t), g.push(y));
  }
  var _ = g.length;
  if (!h && _)
    for (var S = 0; S < p.length; S++) {
      var w = p[S];
      if (w.targetName === t) {
        var b = w.stopTracks(g);
        if (b) {
          var x = nt(p, w);
          p.splice(x, 1);
        }
      }
    }
  if (n.force || (g = xt(g, function(C) {
    return !cS(i[C], e[C]);
  }), _ = g.length), _ > 0 || n.force && !o.length) {
    var M = void 0, D = void 0, A = void 0;
    if (s) {
      D = {}, c && (M = {});
      for (var S = 0; S < _; S++) {
        var y = g[S];
        D[y] = e[y], c ? M[y] = i[y] : e[y] = i[y];
      }
    } else if (c) {
      A = {};
      for (var S = 0; S < _; S++) {
        var y = g[S];
        A[y] = Lo(e[y]), vS(e, i, y);
      }
    }
    var w = new nh(e, !1, !1, h ? xt(p, function(I) {
      return I.targetName === t;
    }) : null);
    w.targetName = t, n.scope && (w.scope = n.scope), c && M && w.whenWithKeys(0, M, g), A && w.whenWithKeys(0, A, g), w.whenWithKeys(u ?? 500, s ? D : i, g).delay(f || 0), r.addAnimator(w, t), o.push(w);
  }
}
var gt = (function(r) {
  ut(t, r);
  function t(e) {
    var i = r.call(this) || this;
    return i.isGroup = !0, i._children = [], i.attr(e), i;
  }
  return t.prototype.childrenRef = function() {
    return this._children;
  }, t.prototype.children = function() {
    return this._children.slice();
  }, t.prototype.childAt = function(e) {
    return this._children[e];
  }, t.prototype.childOfName = function(e) {
    for (var i = this._children, n = 0; n < i.length; n++)
      if (i[n].name === e)
        return i[n];
  }, t.prototype.childCount = function() {
    return this._children.length;
  }, t.prototype.add = function(e) {
    return e && e !== this && e.parent !== this && (this._children.push(e), this._doAdd(e)), this;
  }, t.prototype.addBefore = function(e, i) {
    if (e && e !== this && e.parent !== this && i && i.parent === this) {
      var n = this._children, a = n.indexOf(i);
      a >= 0 && (n.splice(a, 0, e), this._doAdd(e));
    }
    return this;
  }, t.prototype.replace = function(e, i) {
    var n = nt(this._children, e);
    return n >= 0 && this.replaceAt(i, n), this;
  }, t.prototype.replaceAt = function(e, i) {
    var n = this._children, a = n[i];
    if (e && e !== this && e.parent !== this && e !== a) {
      n[i] = e, a.parent = null;
      var o = this.__zr;
      o && a.removeSelfFromZr(o), this._doAdd(e);
    }
    return this;
  }, t.prototype._doAdd = function(e) {
    e.parent && e.parent.remove(e), e.parent = this;
    var i = this.__zr;
    i && i !== e.__zr && e.addSelfToZr(i), i && i.refresh();
  }, t.prototype.remove = function(e) {
    var i = this.__zr, n = this._children, a = nt(n, e);
    return a < 0 ? this : (n.splice(a, 1), e.parent = null, i && e.removeSelfFromZr(i), i && i.refresh(), this);
  }, t.prototype.removeAll = function() {
    for (var e = this._children, i = this.__zr, n = 0; n < e.length; n++) {
      var a = e[n];
      i && a.removeSelfFromZr(i), a.parent = null;
    }
    return e.length = 0, this;
  }, t.prototype.eachChild = function(e, i) {
    for (var n = this._children, a = 0; a < n.length; a++) {
      var o = n[a];
      e.call(i, o, a);
    }
    return this;
  }, t.prototype.traverse = function(e, i) {
    for (var n = 0; n < this._children.length; n++) {
      var a = this._children[n], o = e.call(i, a);
      a.isGroup && !o && a.traverse(e, i);
    }
    return this;
  }, t.prototype.addSelfToZr = function(e) {
    r.prototype.addSelfToZr.call(this, e);
    for (var i = 0; i < this._children.length; i++) {
      var n = this._children[i];
      n.addSelfToZr(e);
    }
  }, t.prototype.removeSelfFromZr = function(e) {
    r.prototype.removeSelfFromZr.call(this, e);
    for (var i = 0; i < this._children.length; i++) {
      var n = this._children[i];
      n.removeSelfFromZr(e);
    }
  }, t.prototype.getBoundingRect = function(e) {
    for (var i = new it(0, 0, 0, 0), n = e || this._children, a = [], o = null, s = 0; s < n.length; s++) {
      var l = n[s];
      if (!(l.ignore || l.invisible)) {
        var u = l.getBoundingRect(), f = l.getLocalTransform(a);
        f ? (it.applyTransform(i, u, f), o = o || i.clone(), o.union(i)) : (o = o || u.clone(), o.union(u));
      }
    }
    return o || i;
  }, t;
})(xs);
gt.prototype.type = "group";
/*!
* ZRender, a high performance 2d drawing library.
*
* Copyright (c) 2013, Baidu Inc.
* All rights reserved.
*
* LICENSE
* https://github.com/ecomfe/zrender/blob/master/LICENSE.txt
*/
var Oo = {}, ri = {};
function dS(r) {
  delete ri[r];
}
function gS(r) {
  if (!r)
    return !1;
  if (typeof r == "string")
    return ea(r, 1) < $u;
  if (r.colorStops) {
    for (var t = r.colorStops, e = 0, i = t.length, n = 0; n < i; n++)
      e += ea(t[n].color, 1);
    return e /= i, e < $u;
  }
  return !1;
}
var yS = (function() {
  function r(t, e, i) {
    var n = this;
    this._sleepAfterStill = 10, this._stillFrameAccum = 0, this._needsRefresh = !0, this._needsRefreshHover = !0, this._darkMode = !1, i = i || {}, this.dom = e, this.id = t;
    var a = new L1(), o = i.renderer || "canvas";
    Oo[o] || (o = ct(Oo)[0]), i.useDirtyRect = i.useDirtyRect == null ? !1 : i.useDirtyRect;
    var s = new Oo[o](e, a, i, t), l = i.ssr || s.ssrOnly;
    this.storage = a, this.painter = s;
    var u = !Y.node && !Y.worker && !l ? new oS(s.getViewportRoot(), s.root) : null, f = i.useCoarsePointer, h = f == null || f === "auto" ? Y.touchEventsSupported : !!f, c = 44, v;
    h && (v = Z(i.pointerSize, c)), this.handler = new Og(a, s, u, s.root, v), this.animation = new j1({
      stage: {
        update: l ? null : function() {
          return n._flush(!0);
        }
      }
    }), l || this.animation.start();
  }
  return r.prototype.add = function(t) {
    this._disposed || !t || (this.storage.addRoot(t), t.addSelfToZr(this), this.refresh());
  }, r.prototype.remove = function(t) {
    this._disposed || !t || (this.storage.delRoot(t), t.removeSelfFromZr(this), this.refresh());
  }, r.prototype.configLayer = function(t, e) {
    this._disposed || (this.painter.configLayer && this.painter.configLayer(t, e), this.refresh());
  }, r.prototype.setBackgroundColor = function(t) {
    this._disposed || (this.painter.setBackgroundColor && this.painter.setBackgroundColor(t), this.refresh(), this._backgroundColor = t, this._darkMode = gS(t));
  }, r.prototype.getBackgroundColor = function() {
    return this._backgroundColor;
  }, r.prototype.setDarkMode = function(t) {
    this._darkMode = t;
  }, r.prototype.isDarkMode = function() {
    return this._darkMode;
  }, r.prototype.refreshImmediately = function(t) {
    this._disposed || (t || this.animation.update(!0), this._needsRefresh = !1, this.painter.refresh(), this._needsRefresh = !1);
  }, r.prototype.refresh = function() {
    this._disposed || (this._needsRefresh = !0, this.animation.start());
  }, r.prototype.flush = function() {
    this._disposed || this._flush(!1);
  }, r.prototype._flush = function(t) {
    var e, i = Vi();
    this._needsRefresh && (e = !0, this.refreshImmediately(t)), this._needsRefreshHover && (e = !0, this.refreshHoverImmediately());
    var n = Vi();
    e ? (this._stillFrameAccum = 0, this.trigger("rendered", {
      elapsedTime: n - i
    })) : this._sleepAfterStill > 0 && (this._stillFrameAccum++, this._stillFrameAccum > this._sleepAfterStill && this.animation.stop());
  }, r.prototype.setSleepAfterStill = function(t) {
    this._sleepAfterStill = t;
  }, r.prototype.wakeUp = function() {
    this._disposed || (this.animation.start(), this._stillFrameAccum = 0);
  }, r.prototype.refreshHover = function() {
    this._needsRefreshHover = !0;
  }, r.prototype.refreshHoverImmediately = function() {
    this._disposed || (this._needsRefreshHover = !1, this.painter.refreshHover && this.painter.getType() === "canvas" && this.painter.refreshHover());
  }, r.prototype.resize = function(t) {
    this._disposed || (t = t || {}, this.painter.resize(t.width, t.height), this.handler.resize());
  }, r.prototype.clearAnimation = function() {
    this._disposed || this.animation.clear();
  }, r.prototype.getWidth = function() {
    if (!this._disposed)
      return this.painter.getWidth();
  }, r.prototype.getHeight = function() {
    if (!this._disposed)
      return this.painter.getHeight();
  }, r.prototype.setCursorStyle = function(t) {
    this._disposed || this.handler.setCursorStyle(t);
  }, r.prototype.findHover = function(t, e) {
    if (!this._disposed)
      return this.handler.findHover(t, e);
  }, r.prototype.on = function(t, e, i) {
    return this._disposed || this.handler.on(t, e, i), this;
  }, r.prototype.off = function(t, e) {
    this._disposed || this.handler.off(t, e);
  }, r.prototype.trigger = function(t, e) {
    this._disposed || this.handler.trigger(t, e);
  }, r.prototype.clear = function() {
    if (!this._disposed) {
      for (var t = this.storage.getRoots(), e = 0; e < t.length; e++)
        t[e] instanceof gt && t[e].removeSelfFromZr(this);
      this.storage.delAllRoots(), this.painter.clear();
    }
  }, r.prototype.dispose = function() {
    this._disposed || (this.animation.stop(), this.clear(), this.storage.dispose(), this.painter.dispose(), this.handler.dispose(), this.animation = this.storage = this.painter = this.handler = null, this._disposed = !0, dS(this.id));
  }, r;
})();
function Ku(r, t) {
  var e = new yS(Zf(), r, t);
  return ri[e.id] = e, e;
}
function mS(r) {
  r.dispose();
}
function _S() {
  for (var r in ri)
    ri.hasOwnProperty(r) && ri[r].dispose();
  ri = {};
}
function SS(r) {
  return ri[r];
}
function qg(r, t) {
  Oo[r] = t;
}
var Qu;
function bS(r) {
  if (typeof Qu == "function")
    return Qu(r);
}
function Kg(r) {
  Qu = r;
}
var wS = "5.6.1";
const xS = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  dispose: mS,
  disposeAll: _S,
  getElementSSRData: bS,
  getInstance: SS,
  init: Ku,
  registerPainter: qg,
  registerSSRDataGetter: Kg,
  version: wS
}, Symbol.toStringTag, { value: "Module" }));
var zv = 1e-4, Qg = 20;
function TS(r) {
  return r.replace(/^\s+|\s+$/g, "");
}
function Ye(r, t, e, i) {
  var n = t[0], a = t[1], o = e[0], s = e[1], l = a - n, u = s - o;
  if (l === 0)
    return u === 0 ? o : (o + s) / 2;
  if (i)
    if (l > 0) {
      if (r <= n)
        return o;
      if (r >= a)
        return s;
    } else {
      if (r >= n)
        return o;
      if (r <= a)
        return s;
    }
  else {
    if (r === n)
      return o;
    if (r === a)
      return s;
  }
  return (r - n) / l * u + o;
}
function Mt(r, t) {
  switch (r) {
    case "center":
    case "middle":
      r = "50%";
      break;
    case "left":
    case "top":
      r = "0%";
      break;
    case "right":
    case "bottom":
      r = "100%";
      break;
  }
  return V(r) ? TS(r).match(/%$/) ? parseFloat(r) / 100 * t : parseFloat(r) : r == null ? NaN : +r;
}
function St(r, t, e) {
  return t == null && (t = 10), t = Math.min(Math.max(0, t), Qg), r = (+r).toFixed(t), e ? r : +r;
}
function lh(r) {
  return r.sort(function(t, e) {
    return t - e;
  }), r;
}
function De(r) {
  if (r = +r, isNaN(r))
    return 0;
  if (r > 1e-14) {
    for (var t = 1, e = 0; e < 15; e++, t *= 10)
      if (Math.round(r * t) / t === r)
        return e;
  }
  return Jg(r);
}
function Jg(r) {
  var t = r.toString().toLowerCase(), e = t.indexOf("e"), i = e > 0 ? +t.slice(e + 1) : 0, n = e > 0 ? e : t.length, a = t.indexOf("."), o = a < 0 ? 0 : n - 1 - a;
  return Math.max(0, o - i);
}
function jg(r, t) {
  var e = Math.log, i = Math.LN10, n = Math.floor(e(r[1] - r[0]) / i), a = Math.round(e(Math.abs(t[1] - t[0])) / i), o = Math.min(Math.max(-n + a, 0), 20);
  return isFinite(o) ? o : 20;
}
function CS(r, t, e) {
  if (!r[t])
    return 0;
  var i = MS(r, e);
  return i[t] || 0;
}
function MS(r, t) {
  var e = We(r, function(v, p) {
    return v + (isNaN(p) ? 0 : p);
  }, 0);
  if (e === 0)
    return [];
  for (var i = Math.pow(10, t), n = z(r, function(v) {
    return (isNaN(v) ? 0 : v) / e * i * 100;
  }), a = i * 100, o = z(n, function(v) {
    return Math.floor(v);
  }), s = We(o, function(v, p) {
    return v + p;
  }, 0), l = z(n, function(v, p) {
    return v - o[p];
  }); s < a; ) {
    for (var u = Number.NEGATIVE_INFINITY, f = null, h = 0, c = l.length; h < c; ++h)
      l[h] > u && (u = l[h], f = h);
    ++o[f], l[f] = 0, ++s;
  }
  return z(o, function(v) {
    return v / i;
  });
}
function DS(r, t) {
  var e = Math.max(De(r), De(t)), i = r + t;
  return e > Qg ? i : St(i, e);
}
var AS = 9007199254740991;
function uh(r) {
  var t = Math.PI * 2;
  return (r % t + t) % t;
}
function ia(r) {
  return r > -zv && r < zv;
}
var IS = /^(?:(\d{4})(?:[-\/](\d{1,2})(?:[-\/](\d{1,2})(?:[T ](\d{1,2})(?::(\d{1,2})(?::(\d{1,2})(?:[.,](\d+))?)?)?(Z|[\+\-]\d\d:?\d\d)?)?)?)?)?$/;
function pe(r) {
  if (r instanceof Date)
    return r;
  if (V(r)) {
    var t = IS.exec(r);
    if (!t)
      return /* @__PURE__ */ new Date(NaN);
    if (t[8]) {
      var e = +t[4] || 0;
      return t[8].toUpperCase() !== "Z" && (e -= +t[8].slice(0, 3)), new Date(Date.UTC(+t[1], +(t[2] || 1) - 1, +t[3] || 1, e, +(t[5] || 0), +t[6] || 0, t[7] ? +t[7].substring(0, 3) : 0));
    } else
      return new Date(+t[1], +(t[2] || 1) - 1, +t[3] || 1, +t[4] || 0, +(t[5] || 0), +t[6] || 0, t[7] ? +t[7].substring(0, 3) : 0);
  } else if (r == null)
    return /* @__PURE__ */ new Date(NaN);
  return new Date(Math.round(r));
}
function ty(r) {
  return Math.pow(10, Ts(r));
}
function Ts(r) {
  if (r === 0)
    return 0;
  var t = Math.floor(Math.log(r) / Math.LN10);
  return r / Math.pow(10, t) >= 10 && t++, t;
}
function fh(r, t) {
  var e = Ts(r), i = Math.pow(10, e), n = r / i, a;
  return t ? n < 1.5 ? a = 1 : n < 2.5 ? a = 2 : n < 4 ? a = 3 : n < 7 ? a = 5 : a = 10 : n < 1 ? a = 1 : n < 2 ? a = 2 : n < 3 ? a = 3 : n < 5 ? a = 5 : a = 10, r = a * i, e >= -20 ? +r.toFixed(e < 0 ? -e : 0) : r;
}
function LS(r, t) {
  var e = (r.length - 1) * t + 1, i = Math.floor(e), n = +r[i - 1], a = e - i;
  return a ? n + a * (r[i] - n) : n;
}
function Ju(r) {
  r.sort(function(l, u) {
    return s(l, u, 0) ? -1 : 1;
  });
  for (var t = -1 / 0, e = 1, i = 0; i < r.length; ) {
    for (var n = r[i].interval, a = r[i].close, o = 0; o < 2; o++)
      n[o] <= t && (n[o] = t, a[o] = o ? 1 : 1 - e), t = n[o], e = a[o];
    n[0] === n[1] && a[0] * a[1] !== 1 ? r.splice(i, 1) : i++;
  }
  return r;
  function s(l, u, f) {
    return l.interval[f] < u.interval[f] || l.interval[f] === u.interval[f] && (l.close[f] - u.close[f] === (f ? -1 : 1) || !f && s(l, u, 1));
  }
}
function na(r) {
  var t = parseFloat(r);
  return t == r && (t !== 0 || !V(r) || r.indexOf("x") <= 0) ? t : NaN;
}
function ey(r) {
  return !isNaN(na(r));
}
function ry() {
  return Math.round(Math.random() * 9);
}
function iy(r, t) {
  return t === 0 ? r : iy(t, r % t);
}
function Fv(r, t) {
  return r == null ? t : t == null ? r : r * t / iy(r, t);
}
function Zt(r) {
  throw new Error(r);
}
function Vv(r, t, e) {
  return (t - r) * e + r;
}
var ny = "series\0", PS = "\0_ec_\0";
function Dt(r) {
  return r instanceof Array ? r : r == null ? [] : [r];
}
function ju(r, t, e) {
  if (r) {
    r[t] = r[t] || {}, r.emphasis = r.emphasis || {}, r.emphasis[t] = r.emphasis[t] || {};
    for (var i = 0, n = e.length; i < n; i++) {
      var a = e[i];
      !r.emphasis[t].hasOwnProperty(a) && r[t].hasOwnProperty(a) && (r.emphasis[t][a] = r[t][a]);
    }
  }
}
var Hv = ["fontStyle", "fontWeight", "fontSize", "fontFamily", "rich", "tag", "color", "textBorderColor", "textBorderWidth", "width", "height", "lineHeight", "align", "verticalAlign", "baseline", "shadowColor", "shadowBlur", "shadowOffsetX", "shadowOffsetY", "textShadowColor", "textShadowBlur", "textShadowOffsetX", "textShadowOffsetY", "backgroundColor", "borderColor", "borderWidth", "borderRadius", "padding"];
function Ta(r) {
  return H(r) && !O(r) && !(r instanceof Date) ? r.value : r;
}
function RS(r) {
  return H(r) && !(r instanceof Array);
}
function ES(r, t, e) {
  var i = e === "normalMerge", n = e === "replaceMerge", a = e === "replaceAll";
  r = r || [], t = (t || []).slice();
  var o = q();
  T(t, function(l, u) {
    if (!H(l)) {
      t[u] = null;
      return;
    }
  });
  var s = OS(r, o, e);
  return (i || n) && kS(s, r, o, t), i && NS(s, t), i || n ? BS(s, t, n) : a && zS(s, t), FS(s), s;
}
function OS(r, t, e) {
  var i = [];
  if (e === "replaceAll")
    return i;
  for (var n = 0; n < r.length; n++) {
    var a = r[n];
    a && a.id != null && t.set(a.id, n), i.push({
      existing: e === "replaceMerge" || aa(a) ? null : a,
      newOption: null,
      keyInfo: null,
      brandNew: null
    });
  }
  return i;
}
function kS(r, t, e, i) {
  T(i, function(n, a) {
    if (!(!n || n.id == null)) {
      var o = Hn(n.id), s = e.get(o);
      if (s != null) {
        var l = r[s];
        Ee(!l.newOption, 'Duplicated option on id "' + o + '".'), l.newOption = n, l.existing = t[s], i[a] = null;
      }
    }
  });
}
function NS(r, t) {
  T(t, function(e, i) {
    if (!(!e || e.name == null))
      for (var n = 0; n < r.length; n++) {
        var a = r[n].existing;
        if (!r[n].newOption && a && (a.id == null || e.id == null) && !aa(e) && !aa(a) && ay("name", a, e)) {
          r[n].newOption = e, t[i] = null;
          return;
        }
      }
  });
}
function BS(r, t, e) {
  T(t, function(i) {
    if (i) {
      for (
        var n, a = 0;
        // Be `!resultItem` only when `nextIdx >= result.length`.
        (n = r[a]) && (n.newOption || aa(n.existing) || // In mode "replaceMerge", here no not-mapped-non-internal-existing.
        n.existing && i.id != null && !ay("id", i, n.existing));
      )
        a++;
      n ? (n.newOption = i, n.brandNew = e) : r.push({
        newOption: i,
        brandNew: e,
        existing: null,
        keyInfo: null
      }), a++;
    }
  });
}
function zS(r, t) {
  T(t, function(e) {
    r.push({
      newOption: e,
      brandNew: !0,
      existing: null,
      keyInfo: null
    });
  });
}
function FS(r) {
  var t = q();
  T(r, function(e) {
    var i = e.existing;
    i && t.set(i.id, e);
  }), T(r, function(e) {
    var i = e.newOption;
    Ee(!i || i.id == null || !t.get(i.id) || t.get(i.id) === e, "id duplicates: " + (i && i.id)), i && i.id != null && t.set(i.id, e), !e.keyInfo && (e.keyInfo = {});
  }), T(r, function(e, i) {
    var n = e.existing, a = e.newOption, o = e.keyInfo;
    if (H(a)) {
      if (o.name = a.name != null ? Hn(a.name) : n ? n.name : ny + i, n)
        o.id = Hn(n.id);
      else if (a.id != null)
        o.id = Hn(a.id);
      else {
        var s = 0;
        do
          o.id = "\0" + o.name + "\0" + s++;
        while (t.get(o.id));
      }
      t.set(o.id, e);
    }
  });
}
function ay(r, t, e) {
  var i = Pe(t[r], null), n = Pe(e[r], null);
  return i != null && n != null && i === n;
}
function Hn(r) {
  return Pe(r, "");
}
function Pe(r, t) {
  return r == null ? t : V(r) ? r : vt(r) || Go(r) ? r + "" : t;
}
function hh(r) {
  var t = r.name;
  return !!(t && t.indexOf(ny));
}
function aa(r) {
  return r && r.id != null && Hn(r.id).indexOf(PS) === 0;
}
function VS(r, t, e) {
  T(r, function(i) {
    var n = i.newOption;
    H(n) && (i.keyInfo.mainType = t, i.keyInfo.subType = HS(t, n, i.existing, e));
  });
}
function HS(r, t, e, i) {
  var n = t.type ? t.type : e ? e.subType : i.determineSubType(r, t);
  return n;
}
function GS(r, t) {
  var e = {}, i = {};
  return n(r || [], e), n(t || [], i, e), [a(e), a(i)];
  function n(o, s, l) {
    for (var u = 0, f = o.length; u < f; u++) {
      var h = Pe(o[u].seriesId, null);
      if (h == null)
        return;
      for (var c = Dt(o[u].dataIndex), v = l && l[h], p = 0, g = c.length; p < g; p++) {
        var d = c[p];
        v && v[d] ? v[d] = null : (s[h] || (s[h] = {}))[d] = 1;
      }
    }
  }
  function a(o, s) {
    var l = [];
    for (var u in o)
      if (o.hasOwnProperty(u) && o[u] != null)
        if (s)
          l.push(+u);
        else {
          var f = a(o[u], !0);
          f.length && l.push({
            seriesId: u,
            dataIndex: f
          });
        }
    return l;
  }
}
function ci(r, t) {
  if (t.dataIndexInside != null)
    return t.dataIndexInside;
  if (t.dataIndex != null)
    return O(t.dataIndex) ? z(t.dataIndex, function(e) {
      return r.indexOfRawIndex(e);
    }) : r.indexOfRawIndex(t.dataIndex);
  if (t.name != null)
    return O(t.name) ? z(t.name, function(e) {
      return r.indexOfName(e);
    }) : r.indexOfName(t.name);
}
function bt() {
  var r = "__ec_inner_" + WS++;
  return function(t) {
    return t[r] || (t[r] = {});
  };
}
var WS = ry();
function wl(r, t, e) {
  var i = vh(t, e), n = i.mainTypeSpecified, a = i.queryOptionMap, o = i.others, s = o, l = e ? e.defaultMainType : null;
  return !n && l && a.set(l, {}), a.each(function(u, f) {
    var h = Ca(r, f, u, {
      useDefault: l === f,
      enableAll: e && e.enableAll != null ? e.enableAll : !0,
      enableNone: e && e.enableNone != null ? e.enableNone : !0
    });
    s[f + "Models"] = h.models, s[f + "Model"] = h.models[0];
  }), s;
}
function vh(r, t) {
  var e;
  if (V(r)) {
    var i = {};
    i[r + "Index"] = 0, e = i;
  } else
    e = r;
  var n = q(), a = {}, o = !1;
  return T(e, function(s, l) {
    if (l === "dataIndex" || l === "dataIndexInside") {
      a[l] = s;
      return;
    }
    var u = l.match(/^(\w+)(Index|Id|Name)$/) || [], f = u[1], h = (u[2] || "").toLowerCase();
    if (!(!f || !h || t && t.includeMainTypes && nt(t.includeMainTypes, f) < 0)) {
      o = o || !!f;
      var c = n.get(f) || n.set(f, {});
      c[h] = s;
    }
  }), {
    mainTypeSpecified: o,
    queryOptionMap: n,
    others: a
  };
}
var Ae = {
  useDefault: !0,
  enableAll: !1,
  enableNone: !1
};
function Ca(r, t, e, i) {
  i = i || Ae;
  var n = e.index, a = e.id, o = e.name, s = {
    models: null,
    specified: n != null || a != null || o != null
  };
  if (!s.specified) {
    var l = void 0;
    return s.models = i.useDefault && (l = r.getComponent(t)) ? [l] : [], s;
  }
  return n === "none" || n === !1 ? (Ee(i.enableNone, '`"none"` or `false` is not a valid value on index option.'), s.models = [], s) : (n === "all" && (Ee(i.enableAll, '`"all"` is not a valid value on index option.'), n = a = o = null), s.models = r.queryComponents({
    mainType: t,
    index: n,
    id: a,
    name: o
  }), s);
}
function oy(r, t, e) {
  r.setAttribute ? r.setAttribute(t, e) : r[t] = e;
}
function US(r, t) {
  return r.getAttribute ? r.getAttribute(t) : r[t];
}
function YS(r) {
  return r === "auto" ? Y.domSupported ? "html" : "richText" : r || "html";
}
function XS(r, t, e, i, n) {
  var a = t == null || t === "auto";
  if (i == null)
    return i;
  if (vt(i)) {
    var o = Vv(e || 0, i, n);
    return St(o, a ? Math.max(De(e || 0), De(i)) : t);
  } else {
    if (V(i))
      return n < 1 ? e : i;
    for (var s = [], l = e, u = i, f = Math.max(l ? l.length : 0, u.length), h = 0; h < f; ++h) {
      var c = r.getDimensionInfo(h);
      if (c && c.type === "ordinal")
        s[h] = (n < 1 && l ? l : u)[h];
      else {
        var v = l && l[h] ? l[h] : 0, p = u[h], o = Vv(v, p, n);
        s[h] = St(o, a ? Math.max(De(v), De(p)) : t);
      }
    }
    return s;
  }
}
var $S = ".", Fr = "___EC__COMPONENT__CONTAINER___", sy = "___EC__EXTENDED_CLASS___";
function Ge(r) {
  var t = {
    main: "",
    sub: ""
  };
  if (r) {
    var e = r.split($S);
    t.main = e[0] || "", t.sub = e[1] || "";
  }
  return t;
}
function ZS(r) {
  Ee(/^[a-zA-Z0-9_]+([.][a-zA-Z0-9_]+)?$/.test(r), 'componentType "' + r + '" illegal');
}
function qS(r) {
  return !!(r && r[sy]);
}
function ch(r, t) {
  r.$constructor = r, r.extend = function(e) {
    var i = this, n;
    return KS(i) ? n = /** @class */
    (function(a) {
      F(o, a);
      function o() {
        return a.apply(this, arguments) || this;
      }
      return o;
    })(i) : (n = function() {
      (e.$constructor || i).apply(this, arguments);
    }, qf(n, this)), k(n.prototype, e), n[sy] = !0, n.extend = this.extend, n.superCall = jS, n.superApply = tb, n.superClass = i, n;
  };
}
function KS(r) {
  return X(r) && /^class\s/.test(Function.prototype.toString.call(r));
}
function ly(r, t) {
  r.extend = t.extend;
}
var QS = Math.round(Math.random() * 10);
function JS(r) {
  var t = ["__\0is_clz", QS++].join("_");
  r.prototype[t] = !0, r.isInstance = function(e) {
    return !!(e && e[t]);
  };
}
function jS(r, t) {
  for (var e = [], i = 2; i < arguments.length; i++)
    e[i - 2] = arguments[i];
  return this.superClass.prototype[t].apply(r, e);
}
function tb(r, t, e) {
  return this.superClass.prototype[t].apply(r, e);
}
function Cs(r) {
  var t = {};
  r.registerClass = function(i) {
    var n = i.type || i.prototype.type;
    if (n) {
      ZS(n), i.prototype.type = n;
      var a = Ge(n);
      if (!a.sub)
        t[a.main] = i;
      else if (a.sub !== Fr) {
        var o = e(a);
        o[a.sub] = i;
      }
    }
    return i;
  }, r.getClass = function(i, n, a) {
    var o = t[i];
    if (o && o[Fr] && (o = n ? o[n] : null), a && !o)
      throw new Error(n ? "Component " + i + "." + (n || "") + " is used but not imported." : i + ".type should be specified.");
    return o;
  }, r.getClassesByMainType = function(i) {
    var n = Ge(i), a = [], o = t[n.main];
    return o && o[Fr] ? T(o, function(s, l) {
      l !== Fr && a.push(s);
    }) : a.push(o), a;
  }, r.hasClass = function(i) {
    var n = Ge(i);
    return !!t[n.main];
  }, r.getAllClassMainTypes = function() {
    var i = [];
    return T(t, function(n, a) {
      i.push(a);
    }), i;
  }, r.hasSubTypes = function(i) {
    var n = Ge(i), a = t[n.main];
    return a && a[Fr];
  };
  function e(i) {
    var n = t[i.main];
    return (!n || !n[Fr]) && (n = t[i.main] = {}, n[Fr] = !0), n;
  }
}
function oa(r, t) {
  for (var e = 0; e < r.length; e++)
    r[e][1] || (r[e][1] = r[e][0]);
  return t = t || !1, function(i, n, a) {
    for (var o = {}, s = 0; s < r.length; s++) {
      var l = r[s][1];
      if (!(n && nt(n, l) >= 0 || a && nt(a, l) < 0)) {
        var u = i.getShallow(l, t);
        u != null && (o[r[s][0]] = u);
      }
    }
    return o;
  };
}
var eb = [
  ["fill", "color"],
  ["shadowBlur"],
  ["shadowOffsetX"],
  ["shadowOffsetY"],
  ["opacity"],
  ["shadowColor"]
  // Option decal is in `DecalObject` but style.decal is in `PatternObject`.
  // So do not transfer decal directly.
], rb = oa(eb), ib = (
  /** @class */
  (function() {
    function r() {
    }
    return r.prototype.getAreaStyle = function(t, e) {
      return rb(this, t, e);
    }, r;
  })()
), tf = new xa(50);
function nb(r) {
  if (typeof r == "string") {
    var t = tf.get(r);
    return t && t.image;
  } else
    return r;
}
function uy(r, t, e, i, n) {
  if (r)
    if (typeof r == "string") {
      if (t && t.__zrImageSrc === r || !e)
        return t;
      var a = tf.get(r), o = { hostEl: e, cb: i, cbPayload: n };
      return a ? (t = a.image, !Ms(t) && a.pending.push(o)) : (t = Re.loadImage(r, Gv, Gv), t.__zrImageSrc = r, tf.put(r, t.__cachedImgObj = {
        image: t,
        pending: [o]
      })), t;
    } else
      return r;
  else return t;
}
function Gv() {
  var r = this.__cachedImgObj;
  this.onload = this.onerror = this.__cachedImgObj = null;
  for (var t = 0; t < r.pending.length; t++) {
    var e = r.pending[t], i = e.cb;
    i && i(this, e.cbPayload), e.hostEl.dirty();
  }
  r.pending.length = 0;
}
function Ms(r) {
  return r && r.width && r.height;
}
var xl = /\{([a-zA-Z0-9_]+)\|([^}]*)\}/g;
function ab(r, t, e, i, n) {
  var a = {};
  return fy(a, r, t, e, i, n), a.text;
}
function fy(r, t, e, i, n, a) {
  if (!e) {
    r.text = "", r.isTruncated = !1;
    return;
  }
  var o = (t + "").split(`
`);
  a = hy(e, i, n, a);
  for (var s = !1, l = {}, u = 0, f = o.length; u < f; u++)
    vy(l, o[u], a), o[u] = l.textLine, s = s || l.isTruncated;
  r.text = o.join(`
`), r.isTruncated = s;
}
function hy(r, t, e, i) {
  i = i || {};
  var n = k({}, i);
  n.font = t, e = Z(e, "..."), n.maxIterations = Z(i.maxIterations, 2);
  var a = n.minChar = Z(i.minChar, 0);
  n.cnCharWidth = ee("国", t);
  var o = n.ascCharWidth = ee("a", t);
  n.placeholder = Z(i.placeholder, "");
  for (var s = r = Math.max(0, r - 1), l = 0; l < a && s >= o; l++)
    s -= o;
  var u = ee(e, t);
  return u > s && (e = "", u = 0), s = r - u, n.ellipsis = e, n.ellipsisWidth = u, n.contentWidth = s, n.containerWidth = r, n;
}
function vy(r, t, e) {
  var i = e.containerWidth, n = e.font, a = e.contentWidth;
  if (!i) {
    r.textLine = "", r.isTruncated = !1;
    return;
  }
  var o = ee(t, n);
  if (o <= i) {
    r.textLine = t, r.isTruncated = !1;
    return;
  }
  for (var s = 0; ; s++) {
    if (o <= a || s >= e.maxIterations) {
      t += e.ellipsis;
      break;
    }
    var l = s === 0 ? ob(t, a, e.ascCharWidth, e.cnCharWidth) : o > 0 ? Math.floor(t.length * a / o) : 0;
    t = t.substr(0, l), o = ee(t, n);
  }
  t === "" && (t = e.placeholder), r.textLine = t, r.isTruncated = !0;
}
function ob(r, t, e, i) {
  for (var n = 0, a = 0, o = r.length; a < o && n < t; a++) {
    var s = r.charCodeAt(a);
    n += 0 <= s && s <= 127 ? e : i;
  }
  return a;
}
function sb(r, t) {
  r != null && (r += "");
  var e = t.overflow, i = t.padding, n = t.font, a = e === "truncate", o = sh(n), s = Z(t.lineHeight, o), l = !!t.backgroundColor, u = t.lineOverflow === "truncate", f = !1, h = t.width, c;
  h != null && (e === "break" || e === "breakAll") ? c = r ? cy(r, t.font, h, e === "breakAll", 0).lines : [] : c = r ? r.split(`
`) : [];
  var v = c.length * s, p = Z(t.height, v);
  if (v > p && u) {
    var g = Math.floor(p / s);
    f = f || c.length > g, c = c.slice(0, g);
  }
  if (r && a && h != null)
    for (var d = hy(h, n, t.ellipsis, {
      minChar: t.truncateMinChar,
      placeholder: t.placeholder
    }), y = {}, m = 0; m < c.length; m++)
      vy(y, c[m], d), c[m] = y.textLine, f = f || y.isTruncated;
  for (var _ = p, S = 0, m = 0; m < c.length; m++)
    S = Math.max(ee(c[m], n), S);
  h == null && (h = S);
  var w = S;
  return i && (_ += i[0] + i[2], w += i[1] + i[3], h += i[1] + i[3]), l && (w = h), {
    lines: c,
    height: p,
    outerWidth: w,
    outerHeight: _,
    lineHeight: s,
    calculatedLineHeight: o,
    contentWidth: S,
    contentHeight: v,
    width: h,
    isTruncated: f
  };
}
var lb = /* @__PURE__ */ (function() {
  function r() {
  }
  return r;
})(), Wv = /* @__PURE__ */ (function() {
  function r(t) {
    this.tokens = [], t && (this.tokens = t);
  }
  return r;
})(), ub = /* @__PURE__ */ (function() {
  function r() {
    this.width = 0, this.height = 0, this.contentWidth = 0, this.contentHeight = 0, this.outerWidth = 0, this.outerHeight = 0, this.lines = [], this.isTruncated = !1;
  }
  return r;
})();
function fb(r, t) {
  var e = new ub();
  if (r != null && (r += ""), !r)
    return e;
  for (var i = t.width, n = t.height, a = t.overflow, o = (a === "break" || a === "breakAll") && i != null ? { width: i, accumWidth: 0, breakAll: a === "breakAll" } : null, s = xl.lastIndex = 0, l; (l = xl.exec(r)) != null; ) {
    var u = l.index;
    u > s && Tl(e, r.substring(s, u), t, o), Tl(e, l[2], t, o, l[1]), s = xl.lastIndex;
  }
  s < r.length && Tl(e, r.substring(s, r.length), t, o);
  var f = [], h = 0, c = 0, v = t.padding, p = a === "truncate", g = t.lineOverflow === "truncate", d = {};
  function y(W, K, tt) {
    W.width = K, W.lineHeight = tt, h += tt, c = Math.max(c, K);
  }
  t: for (var m = 0; m < e.lines.length; m++) {
    for (var _ = e.lines[m], S = 0, w = 0, b = 0; b < _.tokens.length; b++) {
      var x = _.tokens[b], M = x.styleName && t.rich[x.styleName] || {}, D = x.textPadding = M.padding, A = D ? D[1] + D[3] : 0, C = x.font = M.font || t.font;
      x.contentHeight = sh(C);
      var I = Z(M.height, x.contentHeight);
      if (x.innerHeight = I, D && (I += D[0] + D[2]), x.height = I, x.lineHeight = zn(M.lineHeight, t.lineHeight, I), x.align = M && M.align || t.align, x.verticalAlign = M && M.verticalAlign || "middle", g && n != null && h + x.lineHeight > n) {
        var L = e.lines.length;
        b > 0 ? (_.tokens = _.tokens.slice(0, b), y(_, w, S), e.lines = e.lines.slice(0, m + 1)) : e.lines = e.lines.slice(0, m), e.isTruncated = e.isTruncated || e.lines.length < L;
        break t;
      }
      var P = M.width, R = P == null || P === "auto";
      if (typeof P == "string" && P.charAt(P.length - 1) === "%")
        x.percentWidth = P, f.push(x), x.contentWidth = ee(x.text, C);
      else {
        if (R) {
          var E = M.backgroundColor, G = E && E.image;
          G && (G = nb(G), Ms(G) && (x.width = Math.max(x.width, G.width * I / G.height)));
        }
        var N = p && i != null ? i - w : null;
        N != null && N < x.width ? !R || N < A ? (x.text = "", x.width = x.contentWidth = 0) : (fy(d, x.text, N - A, C, t.ellipsis, { minChar: t.truncateMinChar }), x.text = d.text, e.isTruncated = e.isTruncated || d.isTruncated, x.width = x.contentWidth = ee(x.text, C)) : x.contentWidth = ee(x.text, C);
      }
      x.width += A, w += x.width, M && (S = Math.max(S, x.lineHeight));
    }
    y(_, w, S);
  }
  e.outerWidth = e.width = Z(i, c), e.outerHeight = e.height = Z(n, h), e.contentHeight = h, e.contentWidth = c, v && (e.outerWidth += v[1] + v[3], e.outerHeight += v[0] + v[2]);
  for (var m = 0; m < f.length; m++) {
    var x = f[m], B = x.percentWidth;
    x.width = parseInt(B, 10) / 100 * e.width;
  }
  return e;
}
function Tl(r, t, e, i, n) {
  var a = t === "", o = n && e.rich[n] || {}, s = r.lines, l = o.font || e.font, u = !1, f, h;
  if (i) {
    var c = o.padding, v = c ? c[1] + c[3] : 0;
    if (o.width != null && o.width !== "auto") {
      var p = Ue(o.width, i.width) + v;
      s.length > 0 && p + i.accumWidth > i.width && (f = t.split(`
`), u = !0), i.accumWidth = p;
    } else {
      var g = cy(t, l, i.width, i.breakAll, i.accumWidth);
      i.accumWidth = g.accumWidth + v, h = g.linesWidths, f = g.lines;
    }
  } else
    f = t.split(`
`);
  for (var d = 0; d < f.length; d++) {
    var y = f[d], m = new lb();
    if (m.styleName = n, m.text = y, m.isLineHolder = !y && !a, typeof o.width == "number" ? m.width = o.width : m.width = h ? h[d] : ee(y, l), !d && !u) {
      var _ = (s[s.length - 1] || (s[0] = new Wv())).tokens, S = _.length;
      S === 1 && _[0].isLineHolder ? _[0] = m : (y || !S || a) && _.push(m);
    } else
      s.push(new Wv([m]));
  }
}
function hb(r) {
  var t = r.charCodeAt(0);
  return t >= 32 && t <= 591 || t >= 880 && t <= 4351 || t >= 4608 && t <= 5119 || t >= 7680 && t <= 8303;
}
var vb = We(",&?/;] ".split(""), function(r, t) {
  return r[t] = !0, r;
}, {});
function cb(r) {
  return hb(r) ? !!vb[r] : !0;
}
function cy(r, t, e, i, n) {
  for (var a = [], o = [], s = "", l = "", u = 0, f = 0, h = 0; h < r.length; h++) {
    var c = r.charAt(h);
    if (c === `
`) {
      l && (s += l, f += u), a.push(s), o.push(f), s = "", l = "", u = 0, f = 0;
      continue;
    }
    var v = ee(c, t), p = i ? !1 : !cb(c);
    if (a.length ? f + v > e : n + f + v > e) {
      f ? (s || l) && (p ? (s || (s = l, l = "", u = 0, f = u), a.push(s), o.push(f - u), l += c, u += v, s = "", f = u) : (l && (s += l, l = "", u = 0), a.push(s), o.push(f), s = c, f = v)) : p ? (a.push(l), o.push(u), l = c, u = v) : (a.push(c), o.push(v));
      continue;
    }
    f += v, p ? (l += c, u += v) : (l && (s += l, l = "", u = 0), s += c);
  }
  return !a.length && !s && (s = r, l = "", u = 0), l && (s += l), s && (a.push(s), o.push(f)), a.length === 1 && (f += n), {
    accumWidth: f,
    lines: a,
    linesWidths: o
  };
}
var ef = "__zr_style_" + Math.round(Math.random() * 10), li = {
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  shadowColor: "#000",
  opacity: 1,
  blend: "source-over"
}, Ds = {
  style: {
    shadowBlur: !0,
    shadowOffsetX: !0,
    shadowOffsetY: !0,
    shadowColor: !0,
    opacity: !0
  }
};
li[ef] = !0;
var Uv = ["z", "z2", "invisible"], pb = ["invisible"], Ma = (function(r) {
  ut(t, r);
  function t(e) {
    return r.call(this, e) || this;
  }
  return t.prototype._init = function(e) {
    for (var i = ct(e), n = 0; n < i.length; n++) {
      var a = i[n];
      a === "style" ? this.useStyle(e[a]) : r.prototype.attrKV.call(this, a, e[a]);
    }
    this.style || this.useStyle({});
  }, t.prototype.beforeBrush = function() {
  }, t.prototype.afterBrush = function() {
  }, t.prototype.innerBeforeBrush = function() {
  }, t.prototype.innerAfterBrush = function() {
  }, t.prototype.shouldBePainted = function(e, i, n, a) {
    var o = this.transform;
    if (this.ignore || this.invisible || this.style.opacity === 0 || this.culling && db(this, e, i) || o && !o[0] && !o[3])
      return !1;
    if (n && this.__clipPaths) {
      for (var s = 0; s < this.__clipPaths.length; ++s)
        if (this.__clipPaths[s].isZeroArea())
          return !1;
    }
    if (a && this.parent)
      for (var l = this.parent; l; ) {
        if (l.ignore)
          return !1;
        l = l.parent;
      }
    return !0;
  }, t.prototype.contain = function(e, i) {
    return this.rectContain(e, i);
  }, t.prototype.traverse = function(e, i) {
    e.call(i, this);
  }, t.prototype.rectContain = function(e, i) {
    var n = this.transformCoordToLocal(e, i), a = this.getBoundingRect();
    return a.contain(n[0], n[1]);
  }, t.prototype.getPaintRect = function() {
    var e = this._paintRect;
    if (!this._paintRect || this.__dirty) {
      var i = this.transform, n = this.getBoundingRect(), a = this.style, o = a.shadowBlur || 0, s = a.shadowOffsetX || 0, l = a.shadowOffsetY || 0;
      e = this._paintRect || (this._paintRect = new it(0, 0, 0, 0)), i ? it.applyTransform(e, n, i) : e.copy(n), (o || s || l) && (e.width += o * 2 + Math.abs(s), e.height += o * 2 + Math.abs(l), e.x = Math.min(e.x, e.x + s - o), e.y = Math.min(e.y, e.y + l - o));
      var u = this.dirtyRectTolerance;
      e.isZero() || (e.x = Math.floor(e.x - u), e.y = Math.floor(e.y - u), e.width = Math.ceil(e.width + 1 + u * 2), e.height = Math.ceil(e.height + 1 + u * 2));
    }
    return e;
  }, t.prototype.setPrevPaintRect = function(e) {
    e ? (this._prevPaintRect = this._prevPaintRect || new it(0, 0, 0, 0), this._prevPaintRect.copy(e)) : this._prevPaintRect = null;
  }, t.prototype.getPrevPaintRect = function() {
    return this._prevPaintRect;
  }, t.prototype.animateStyle = function(e) {
    return this.animate("style", e);
  }, t.prototype.updateDuringAnimation = function(e) {
    e === "style" ? this.dirtyStyle() : this.markRedraw();
  }, t.prototype.attrKV = function(e, i) {
    e !== "style" ? r.prototype.attrKV.call(this, e, i) : this.style ? this.setStyle(i) : this.useStyle(i);
  }, t.prototype.setStyle = function(e, i) {
    return typeof e == "string" ? this.style[e] = i : k(this.style, e), this.dirtyStyle(), this;
  }, t.prototype.dirtyStyle = function(e) {
    e || this.markRedraw(), this.__dirty |= Pn, this._rect && (this._rect = null);
  }, t.prototype.dirty = function() {
    this.dirtyStyle();
  }, t.prototype.styleChanged = function() {
    return !!(this.__dirty & Pn);
  }, t.prototype.styleUpdated = function() {
    this.__dirty &= ~Pn;
  }, t.prototype.createStyle = function(e) {
    return Sa(li, e);
  }, t.prototype.useStyle = function(e) {
    e[ef] || (e = this.createStyle(e)), this.__inHover ? this.__hoverStyle = e : this.style = e, this.dirtyStyle();
  }, t.prototype.isStyleObject = function(e) {
    return e[ef];
  }, t.prototype._innerSaveToNormal = function(e) {
    r.prototype._innerSaveToNormal.call(this, e);
    var i = this._normalState;
    e.style && !i.style && (i.style = this._mergeStyle(this.createStyle(), this.style)), this._savePrimaryToNormal(e, i, Uv);
  }, t.prototype._applyStateObj = function(e, i, n, a, o, s) {
    r.prototype._applyStateObj.call(this, e, i, n, a, o, s);
    var l = !(i && a), u;
    if (i && i.style ? o ? a ? u = i.style : (u = this._mergeStyle(this.createStyle(), n.style), this._mergeStyle(u, i.style)) : (u = this._mergeStyle(this.createStyle(), a ? this.style : n.style), this._mergeStyle(u, i.style)) : l && (u = n.style), u)
      if (o) {
        var f = this.style;
        if (this.style = this.createStyle(l ? {} : f), l)
          for (var h = ct(f), c = 0; c < h.length; c++) {
            var v = h[c];
            v in u && (u[v] = u[v], this.style[v] = f[v]);
          }
        for (var p = ct(u), c = 0; c < p.length; c++) {
          var v = p[c];
          this.style[v] = this.style[v];
        }
        this._transitionState(e, {
          style: u
        }, s, this.getAnimationStyleProps());
      } else
        this.useStyle(u);
    for (var g = this.__inHover ? pb : Uv, c = 0; c < g.length; c++) {
      var v = g[c];
      i && i[v] != null ? this[v] = i[v] : l && n[v] != null && (this[v] = n[v]);
    }
  }, t.prototype._mergeStates = function(e) {
    for (var i = r.prototype._mergeStates.call(this, e), n, a = 0; a < e.length; a++) {
      var o = e[a];
      o.style && (n = n || {}, this._mergeStyle(n, o.style));
    }
    return n && (i.style = n), i;
  }, t.prototype._mergeStyle = function(e, i) {
    return k(e, i), e;
  }, t.prototype.getAnimationStyleProps = function() {
    return Ds;
  }, t.initDefaultProps = (function() {
    var e = t.prototype;
    e.type = "displayable", e.invisible = !1, e.z = 0, e.z2 = 0, e.zlevel = 0, e.culling = !1, e.cursor = "pointer", e.rectHover = !1, e.incremental = !1, e._rect = null, e.dirtyRectTolerance = 0, e.__dirty = te | Pn;
  })(), t;
})(xs), Cl = new it(0, 0, 0, 0), Ml = new it(0, 0, 0, 0);
function db(r, t, e) {
  return Cl.copy(r.getBoundingRect()), r.transform && Cl.applyTransform(r.transform), Ml.width = t, Ml.height = e, !Cl.intersect(Ml);
}
var he = Math.min, ve = Math.max, Dl = Math.sin, Al = Math.cos, Vr = Math.PI * 2, Ua = yi(), Ya = yi(), Xa = yi();
function Yv(r, t, e, i, n, a) {
  n[0] = he(r, e), n[1] = he(t, i), a[0] = ve(r, e), a[1] = ve(t, i);
}
var Xv = [], $v = [];
function gb(r, t, e, i, n, a, o, s, l, u) {
  var f = Fg, h = Ct, c = f(r, e, n, o, Xv);
  l[0] = 1 / 0, l[1] = 1 / 0, u[0] = -1 / 0, u[1] = -1 / 0;
  for (var v = 0; v < c; v++) {
    var p = h(r, e, n, o, Xv[v]);
    l[0] = he(p, l[0]), u[0] = ve(p, u[0]);
  }
  c = f(t, i, a, s, $v);
  for (var v = 0; v < c; v++) {
    var g = h(t, i, a, s, $v[v]);
    l[1] = he(g, l[1]), u[1] = ve(g, u[1]);
  }
  l[0] = he(r, l[0]), u[0] = ve(r, u[0]), l[0] = he(o, l[0]), u[0] = ve(o, u[0]), l[1] = he(t, l[1]), u[1] = ve(t, u[1]), l[1] = he(s, l[1]), u[1] = ve(s, u[1]);
}
function yb(r, t, e, i, n, a, o, s) {
  var l = Vg, u = $t, f = ve(he(l(r, e, n), 1), 0), h = ve(he(l(t, i, a), 1), 0), c = u(r, e, n, f), v = u(t, i, a, h);
  o[0] = he(r, n, c), o[1] = he(t, a, v), s[0] = ve(r, n, c), s[1] = ve(t, a, v);
}
function mb(r, t, e, i, n, a, o, s, l) {
  var u = dr, f = gr, h = Math.abs(n - a);
  if (h % Vr < 1e-4 && h > 1e-4) {
    s[0] = r - e, s[1] = t - i, l[0] = r + e, l[1] = t + i;
    return;
  }
  if (Ua[0] = Al(n) * e + r, Ua[1] = Dl(n) * i + t, Ya[0] = Al(a) * e + r, Ya[1] = Dl(a) * i + t, u(s, Ua, Ya), f(l, Ua, Ya), n = n % Vr, n < 0 && (n = n + Vr), a = a % Vr, a < 0 && (a = a + Vr), n > a && !o ? a += Vr : n < a && o && (n += Vr), o) {
    var c = a;
    a = n, n = c;
  }
  for (var v = 0; v < a; v += Math.PI / 2)
    v > n && (Xa[0] = Al(v) * e + r, Xa[1] = Dl(v) * i + t, u(s, Xa, s), f(l, Xa, l));
}
var st = {
  M: 1,
  L: 2,
  C: 3,
  Q: 4,
  A: 5,
  Z: 6,
  R: 7
}, Hr = [], Gr = [], Ne = [], ar = [], Be = [], ze = [], Il = Math.min, Ll = Math.max, Wr = Math.cos, Ur = Math.sin, Ke = Math.abs, rf = Math.PI, cr = rf * 2, Pl = typeof Float32Array < "u", dn = [];
function Rl(r) {
  var t = Math.round(r / rf * 1e8) / 1e8;
  return t % 2 * rf;
}
function _b(r, t) {
  var e = Rl(r[0]);
  e < 0 && (e += cr);
  var i = e - r[0], n = r[1];
  n += i, !t && n - e >= cr ? n = e + cr : t && e - n >= cr ? n = e - cr : !t && e > n ? n = e + (cr - Rl(e - n)) : t && e < n && (n = e - (cr - Rl(n - e))), r[0] = e, r[1] = n;
}
var pi = (function() {
  function r(t) {
    this.dpr = 1, this._xi = 0, this._yi = 0, this._x0 = 0, this._y0 = 0, this._len = 0, t && (this._saveData = !1), this._saveData && (this.data = []);
  }
  return r.prototype.increaseVersion = function() {
    this._version++;
  }, r.prototype.getVersion = function() {
    return this._version;
  }, r.prototype.setScale = function(t, e, i) {
    i = i || 0, i > 0 && (this._ux = Ke(i / Qo / t) || 0, this._uy = Ke(i / Qo / e) || 0);
  }, r.prototype.setDPR = function(t) {
    this.dpr = t;
  }, r.prototype.setContext = function(t) {
    this._ctx = t;
  }, r.prototype.getContext = function() {
    return this._ctx;
  }, r.prototype.beginPath = function() {
    return this._ctx && this._ctx.beginPath(), this.reset(), this;
  }, r.prototype.reset = function() {
    this._saveData && (this._len = 0), this._pathSegLen && (this._pathSegLen = null, this._pathLen = 0), this._version++;
  }, r.prototype.moveTo = function(t, e) {
    return this._drawPendingPt(), this.addData(st.M, t, e), this._ctx && this._ctx.moveTo(t, e), this._x0 = t, this._y0 = e, this._xi = t, this._yi = e, this;
  }, r.prototype.lineTo = function(t, e) {
    var i = Ke(t - this._xi), n = Ke(e - this._yi), a = i > this._ux || n > this._uy;
    if (this.addData(st.L, t, e), this._ctx && a && this._ctx.lineTo(t, e), a)
      this._xi = t, this._yi = e, this._pendingPtDist = 0;
    else {
      var o = i * i + n * n;
      o > this._pendingPtDist && (this._pendingPtX = t, this._pendingPtY = e, this._pendingPtDist = o);
    }
    return this;
  }, r.prototype.bezierCurveTo = function(t, e, i, n, a, o) {
    return this._drawPendingPt(), this.addData(st.C, t, e, i, n, a, o), this._ctx && this._ctx.bezierCurveTo(t, e, i, n, a, o), this._xi = a, this._yi = o, this;
  }, r.prototype.quadraticCurveTo = function(t, e, i, n) {
    return this._drawPendingPt(), this.addData(st.Q, t, e, i, n), this._ctx && this._ctx.quadraticCurveTo(t, e, i, n), this._xi = i, this._yi = n, this;
  }, r.prototype.arc = function(t, e, i, n, a, o) {
    this._drawPendingPt(), dn[0] = n, dn[1] = a, _b(dn, o), n = dn[0], a = dn[1];
    var s = a - n;
    return this.addData(st.A, t, e, i, i, n, s, 0, o ? 0 : 1), this._ctx && this._ctx.arc(t, e, i, n, a, o), this._xi = Wr(a) * i + t, this._yi = Ur(a) * i + e, this;
  }, r.prototype.arcTo = function(t, e, i, n, a) {
    return this._drawPendingPt(), this._ctx && this._ctx.arcTo(t, e, i, n, a), this;
  }, r.prototype.rect = function(t, e, i, n) {
    return this._drawPendingPt(), this._ctx && this._ctx.rect(t, e, i, n), this.addData(st.R, t, e, i, n), this;
  }, r.prototype.closePath = function() {
    this._drawPendingPt(), this.addData(st.Z);
    var t = this._ctx, e = this._x0, i = this._y0;
    return t && t.closePath(), this._xi = e, this._yi = i, this;
  }, r.prototype.fill = function(t) {
    t && t.fill(), this.toStatic();
  }, r.prototype.stroke = function(t) {
    t && t.stroke(), this.toStatic();
  }, r.prototype.len = function() {
    return this._len;
  }, r.prototype.setData = function(t) {
    var e = t.length;
    !(this.data && this.data.length === e) && Pl && (this.data = new Float32Array(e));
    for (var i = 0; i < e; i++)
      this.data[i] = t[i];
    this._len = e;
  }, r.prototype.appendPath = function(t) {
    t instanceof Array || (t = [t]);
    for (var e = t.length, i = 0, n = this._len, a = 0; a < e; a++)
      i += t[a].len();
    Pl && this.data instanceof Float32Array && (this.data = new Float32Array(n + i));
    for (var a = 0; a < e; a++)
      for (var o = t[a].data, s = 0; s < o.length; s++)
        this.data[n++] = o[s];
    this._len = n;
  }, r.prototype.addData = function(t, e, i, n, a, o, s, l, u) {
    if (this._saveData) {
      var f = this.data;
      this._len + arguments.length > f.length && (this._expandData(), f = this.data);
      for (var h = 0; h < arguments.length; h++)
        f[this._len++] = arguments[h];
    }
  }, r.prototype._drawPendingPt = function() {
    this._pendingPtDist > 0 && (this._ctx && this._ctx.lineTo(this._pendingPtX, this._pendingPtY), this._pendingPtDist = 0);
  }, r.prototype._expandData = function() {
    if (!(this.data instanceof Array)) {
      for (var t = [], e = 0; e < this._len; e++)
        t[e] = this.data[e];
      this.data = t;
    }
  }, r.prototype.toStatic = function() {
    if (this._saveData) {
      this._drawPendingPt();
      var t = this.data;
      t instanceof Array && (t.length = this._len, Pl && this._len > 11 && (this.data = new Float32Array(t)));
    }
  }, r.prototype.getBoundingRect = function() {
    Ne[0] = Ne[1] = Be[0] = Be[1] = Number.MAX_VALUE, ar[0] = ar[1] = ze[0] = ze[1] = -Number.MAX_VALUE;
    var t = this.data, e = 0, i = 0, n = 0, a = 0, o;
    for (o = 0; o < this._len; ) {
      var s = t[o++], l = o === 1;
      switch (l && (e = t[o], i = t[o + 1], n = e, a = i), s) {
        case st.M:
          e = n = t[o++], i = a = t[o++], Be[0] = n, Be[1] = a, ze[0] = n, ze[1] = a;
          break;
        case st.L:
          Yv(e, i, t[o], t[o + 1], Be, ze), e = t[o++], i = t[o++];
          break;
        case st.C:
          gb(e, i, t[o++], t[o++], t[o++], t[o++], t[o], t[o + 1], Be, ze), e = t[o++], i = t[o++];
          break;
        case st.Q:
          yb(e, i, t[o++], t[o++], t[o], t[o + 1], Be, ze), e = t[o++], i = t[o++];
          break;
        case st.A:
          var u = t[o++], f = t[o++], h = t[o++], c = t[o++], v = t[o++], p = t[o++] + v;
          o += 1;
          var g = !t[o++];
          l && (n = Wr(v) * h + u, a = Ur(v) * c + f), mb(u, f, h, c, v, p, g, Be, ze), e = Wr(p) * h + u, i = Ur(p) * c + f;
          break;
        case st.R:
          n = e = t[o++], a = i = t[o++];
          var d = t[o++], y = t[o++];
          Yv(n, a, n + d, a + y, Be, ze);
          break;
        case st.Z:
          e = n, i = a;
          break;
      }
      dr(Ne, Ne, Be), gr(ar, ar, ze);
    }
    return o === 0 && (Ne[0] = Ne[1] = ar[0] = ar[1] = 0), new it(Ne[0], Ne[1], ar[0] - Ne[0], ar[1] - Ne[1]);
  }, r.prototype._calculateLength = function() {
    var t = this.data, e = this._len, i = this._ux, n = this._uy, a = 0, o = 0, s = 0, l = 0;
    this._pathSegLen || (this._pathSegLen = []);
    for (var u = this._pathSegLen, f = 0, h = 0, c = 0; c < e; ) {
      var v = t[c++], p = c === 1;
      p && (a = t[c], o = t[c + 1], s = a, l = o);
      var g = -1;
      switch (v) {
        case st.M:
          a = s = t[c++], o = l = t[c++];
          break;
        case st.L: {
          var d = t[c++], y = t[c++], m = d - a, _ = y - o;
          (Ke(m) > i || Ke(_) > n || c === e - 1) && (g = Math.sqrt(m * m + _ * _), a = d, o = y);
          break;
        }
        case st.C: {
          var S = t[c++], w = t[c++], d = t[c++], y = t[c++], b = t[c++], x = t[c++];
          g = R1(a, o, S, w, d, y, b, x, 10), a = b, o = x;
          break;
        }
        case st.Q: {
          var S = t[c++], w = t[c++], d = t[c++], y = t[c++];
          g = k1(a, o, S, w, d, y, 10), a = d, o = y;
          break;
        }
        case st.A:
          var M = t[c++], D = t[c++], A = t[c++], C = t[c++], I = t[c++], L = t[c++], P = L + I;
          c += 1, p && (s = Wr(I) * A + M, l = Ur(I) * C + D), g = Ll(A, C) * Il(cr, Math.abs(L)), a = Wr(P) * A + M, o = Ur(P) * C + D;
          break;
        case st.R: {
          s = a = t[c++], l = o = t[c++];
          var R = t[c++], E = t[c++];
          g = R * 2 + E * 2;
          break;
        }
        case st.Z: {
          var m = s - a, _ = l - o;
          g = Math.sqrt(m * m + _ * _), a = s, o = l;
          break;
        }
      }
      g >= 0 && (u[h++] = g, f += g);
    }
    return this._pathLen = f, f;
  }, r.prototype.rebuildPath = function(t, e) {
    var i = this.data, n = this._ux, a = this._uy, o = this._len, s, l, u, f, h, c, v = e < 1, p, g, d = 0, y = 0, m, _ = 0, S, w;
    if (!(v && (this._pathSegLen || this._calculateLength(), p = this._pathSegLen, g = this._pathLen, m = e * g, !m)))
      t: for (var b = 0; b < o; ) {
        var x = i[b++], M = b === 1;
        switch (M && (u = i[b], f = i[b + 1], s = u, l = f), x !== st.L && _ > 0 && (t.lineTo(S, w), _ = 0), x) {
          case st.M:
            s = u = i[b++], l = f = i[b++], t.moveTo(u, f);
            break;
          case st.L: {
            h = i[b++], c = i[b++];
            var D = Ke(h - u), A = Ke(c - f);
            if (D > n || A > a) {
              if (v) {
                var C = p[y++];
                if (d + C > m) {
                  var I = (m - d) / C;
                  t.lineTo(u * (1 - I) + h * I, f * (1 - I) + c * I);
                  break t;
                }
                d += C;
              }
              t.lineTo(h, c), u = h, f = c, _ = 0;
            } else {
              var L = D * D + A * A;
              L > _ && (S = h, w = c, _ = L);
            }
            break;
          }
          case st.C: {
            var P = i[b++], R = i[b++], E = i[b++], G = i[b++], N = i[b++], B = i[b++];
            if (v) {
              var C = p[y++];
              if (d + C > m) {
                var I = (m - d) / C;
                qo(u, P, E, N, I, Hr), qo(f, R, G, B, I, Gr), t.bezierCurveTo(Hr[1], Gr[1], Hr[2], Gr[2], Hr[3], Gr[3]);
                break t;
              }
              d += C;
            }
            t.bezierCurveTo(P, R, E, G, N, B), u = N, f = B;
            break;
          }
          case st.Q: {
            var P = i[b++], R = i[b++], E = i[b++], G = i[b++];
            if (v) {
              var C = p[y++];
              if (d + C > m) {
                var I = (m - d) / C;
                Ko(u, P, E, I, Hr), Ko(f, R, G, I, Gr), t.quadraticCurveTo(Hr[1], Gr[1], Hr[2], Gr[2]);
                break t;
              }
              d += C;
            }
            t.quadraticCurveTo(P, R, E, G), u = E, f = G;
            break;
          }
          case st.A:
            var W = i[b++], K = i[b++], tt = i[b++], lt = i[b++], yt = i[b++], _t = i[b++], Se = i[b++], Pr = !i[b++], Si = tt > lt ? tt : lt, Jt = Ke(tt - lt) > 1e-3, Tt = yt + _t, $ = !1;
            if (v) {
              var C = p[y++];
              d + C > m && (Tt = yt + _t * (m - d) / C, $ = !0), d += C;
            }
            if (Jt && t.ellipse ? t.ellipse(W, K, tt, lt, Se, yt, Tt, Pr) : t.arc(W, K, Si, yt, Tt, Pr), $)
              break t;
            M && (s = Wr(yt) * tt + W, l = Ur(yt) * lt + K), u = Wr(Tt) * tt + W, f = Ur(Tt) * lt + K;
            break;
          case st.R:
            s = u = i[b], l = f = i[b + 1], h = i[b++], c = i[b++];
            var et = i[b++], Rr = i[b++];
            if (v) {
              var C = p[y++];
              if (d + C > m) {
                var Nt = m - d;
                t.moveTo(h, c), t.lineTo(h + Il(Nt, et), c), Nt -= et, Nt > 0 && t.lineTo(h + et, c + Il(Nt, Rr)), Nt -= Rr, Nt > 0 && t.lineTo(h + Ll(et - Nt, 0), c + Rr), Nt -= et, Nt > 0 && t.lineTo(h, c + Ll(Rr - Nt, 0));
                break t;
              }
              d += C;
            }
            t.rect(h, c, et, Rr);
            break;
          case st.Z:
            if (v) {
              var C = p[y++];
              if (d + C > m) {
                var I = (m - d) / C;
                t.lineTo(u * (1 - I) + s * I, f * (1 - I) + l * I);
                break t;
              }
              d += C;
            }
            t.closePath(), u = s, f = l;
        }
      }
  }, r.prototype.clone = function() {
    var t = new r(), e = this.data;
    return t.data = e.slice ? e.slice() : Array.prototype.slice.call(e), t._len = this._len, t;
  }, r.CMD = st, r.initDefaultProps = (function() {
    var t = r.prototype;
    t._saveData = !0, t._ux = 0, t._uy = 0, t._pendingPtDist = 0, t._version = 0;
  })(), r;
})();
function Ci(r, t, e, i, n, a, o) {
  if (n === 0)
    return !1;
  var s = n, l = 0, u = r;
  if (o > t + s && o > i + s || o < t - s && o < i - s || a > r + s && a > e + s || a < r - s && a < e - s)
    return !1;
  if (r !== e)
    l = (t - i) / (r - e), u = (r * i - e * t) / (r - e);
  else
    return Math.abs(a - r) <= s / 2;
  var f = l * a - o + u, h = f * f / (l * l + 1);
  return h <= s / 2 * s / 2;
}
function Sb(r, t, e, i, n, a, o, s, l, u, f) {
  if (l === 0)
    return !1;
  var h = l;
  if (f > t + h && f > i + h && f > a + h && f > s + h || f < t - h && f < i - h && f < a - h && f < s - h || u > r + h && u > e + h && u > n + h && u > o + h || u < r - h && u < e - h && u < n - h && u < o - h)
    return !1;
  var c = P1(r, t, e, i, n, a, o, s, u, f);
  return c <= h / 2;
}
function bb(r, t, e, i, n, a, o, s, l) {
  if (o === 0)
    return !1;
  var u = o;
  if (l > t + u && l > i + u && l > a + u || l < t - u && l < i - u && l < a - u || s > r + u && s > e + u && s > n + u || s < r - u && s < e - u && s < n - u)
    return !1;
  var f = O1(r, t, e, i, n, a, s, l);
  return f <= u / 2;
}
var Zv = Math.PI * 2;
function $a(r) {
  return r %= Zv, r < 0 && (r += Zv), r;
}
var gn = Math.PI * 2;
function wb(r, t, e, i, n, a, o, s, l) {
  if (o === 0)
    return !1;
  var u = o;
  s -= r, l -= t;
  var f = Math.sqrt(s * s + l * l);
  if (f - u > e || f + u < e)
    return !1;
  if (Math.abs(i - n) % gn < 1e-4)
    return !0;
  if (a) {
    var h = i;
    i = $a(n), n = $a(h);
  } else
    i = $a(i), n = $a(n);
  i > n && (n += gn);
  var c = Math.atan2(l, s);
  return c < 0 && (c += gn), c >= i && c <= n || c + gn >= i && c + gn <= n;
}
function je(r, t, e, i, n, a) {
  if (a > t && a > i || a < t && a < i || i === t)
    return 0;
  var o = (a - t) / (i - t), s = i < t ? 1 : -1;
  (o === 1 || o === 0) && (s = i < t ? 0.5 : -0.5);
  var l = o * (e - r) + r;
  return l === n ? 1 / 0 : l > n ? s : 0;
}
var or = pi.CMD, Yr = Math.PI * 2, xb = 1e-4;
function Tb(r, t) {
  return Math.abs(r - t) < xb;
}
var Bt = [-1, -1, -1], ue = [-1, -1];
function Cb() {
  var r = ue[0];
  ue[0] = ue[1], ue[1] = r;
}
function Mb(r, t, e, i, n, a, o, s, l, u) {
  if (u > t && u > i && u > a && u > s || u < t && u < i && u < a && u < s)
    return 0;
  var f = Zo(t, i, a, s, u, Bt);
  if (f === 0)
    return 0;
  for (var h = 0, c = -1, v = void 0, p = void 0, g = 0; g < f; g++) {
    var d = Bt[g], y = d === 0 || d === 1 ? 0.5 : 1, m = Ct(r, e, n, o, d);
    m < l || (c < 0 && (c = Fg(t, i, a, s, ue), ue[1] < ue[0] && c > 1 && Cb(), v = Ct(t, i, a, s, ue[0]), c > 1 && (p = Ct(t, i, a, s, ue[1]))), c === 2 ? d < ue[0] ? h += v < t ? y : -y : d < ue[1] ? h += p < v ? y : -y : h += s < p ? y : -y : d < ue[0] ? h += v < t ? y : -y : h += s < v ? y : -y);
  }
  return h;
}
function Db(r, t, e, i, n, a, o, s) {
  if (s > t && s > i && s > a || s < t && s < i && s < a)
    return 0;
  var l = E1(t, i, a, s, Bt);
  if (l === 0)
    return 0;
  var u = Vg(t, i, a);
  if (u >= 0 && u <= 1) {
    for (var f = 0, h = $t(t, i, a, u), c = 0; c < l; c++) {
      var v = Bt[c] === 0 || Bt[c] === 1 ? 0.5 : 1, p = $t(r, e, n, Bt[c]);
      p < o || (Bt[c] < u ? f += h < t ? v : -v : f += a < h ? v : -v);
    }
    return f;
  } else {
    var v = Bt[0] === 0 || Bt[0] === 1 ? 0.5 : 1, p = $t(r, e, n, Bt[0]);
    return p < o ? 0 : a < t ? v : -v;
  }
}
function Ab(r, t, e, i, n, a, o, s) {
  if (s -= t, s > e || s < -e)
    return 0;
  var l = Math.sqrt(e * e - s * s);
  Bt[0] = -l, Bt[1] = l;
  var u = Math.abs(i - n);
  if (u < 1e-4)
    return 0;
  if (u >= Yr - 1e-4) {
    i = 0, n = Yr;
    var f = a ? 1 : -1;
    return o >= Bt[0] + r && o <= Bt[1] + r ? f : 0;
  }
  if (i > n) {
    var h = i;
    i = n, n = h;
  }
  i < 0 && (i += Yr, n += Yr);
  for (var c = 0, v = 0; v < 2; v++) {
    var p = Bt[v];
    if (p + r > o) {
      var g = Math.atan2(s, p), f = a ? 1 : -1;
      g < 0 && (g = Yr + g), (g >= i && g <= n || g + Yr >= i && g + Yr <= n) && (g > Math.PI / 2 && g < Math.PI * 1.5 && (f = -f), c += f);
    }
  }
  return c;
}
function py(r, t, e, i, n) {
  for (var a = r.data, o = r.len(), s = 0, l = 0, u = 0, f = 0, h = 0, c, v, p = 0; p < o; ) {
    var g = a[p++], d = p === 1;
    switch (g === or.M && p > 1 && (e || (s += je(l, u, f, h, i, n))), d && (l = a[p], u = a[p + 1], f = l, h = u), g) {
      case or.M:
        f = a[p++], h = a[p++], l = f, u = h;
        break;
      case or.L:
        if (e) {
          if (Ci(l, u, a[p], a[p + 1], t, i, n))
            return !0;
        } else
          s += je(l, u, a[p], a[p + 1], i, n) || 0;
        l = a[p++], u = a[p++];
        break;
      case or.C:
        if (e) {
          if (Sb(l, u, a[p++], a[p++], a[p++], a[p++], a[p], a[p + 1], t, i, n))
            return !0;
        } else
          s += Mb(l, u, a[p++], a[p++], a[p++], a[p++], a[p], a[p + 1], i, n) || 0;
        l = a[p++], u = a[p++];
        break;
      case or.Q:
        if (e) {
          if (bb(l, u, a[p++], a[p++], a[p], a[p + 1], t, i, n))
            return !0;
        } else
          s += Db(l, u, a[p++], a[p++], a[p], a[p + 1], i, n) || 0;
        l = a[p++], u = a[p++];
        break;
      case or.A:
        var y = a[p++], m = a[p++], _ = a[p++], S = a[p++], w = a[p++], b = a[p++];
        p += 1;
        var x = !!(1 - a[p++]);
        c = Math.cos(w) * _ + y, v = Math.sin(w) * S + m, d ? (f = c, h = v) : s += je(l, u, c, v, i, n);
        var M = (i - y) * S / _ + y;
        if (e) {
          if (wb(y, m, S, w, w + b, x, t, M, n))
            return !0;
        } else
          s += Ab(y, m, S, w, w + b, x, M, n);
        l = Math.cos(w + b) * _ + y, u = Math.sin(w + b) * S + m;
        break;
      case or.R:
        f = l = a[p++], h = u = a[p++];
        var D = a[p++], A = a[p++];
        if (c = f + D, v = h + A, e) {
          if (Ci(f, h, c, h, t, i, n) || Ci(c, h, c, v, t, i, n) || Ci(c, v, f, v, t, i, n) || Ci(f, v, f, h, t, i, n))
            return !0;
        } else
          s += je(c, h, c, v, i, n), s += je(f, v, f, h, i, n);
        break;
      case or.Z:
        if (e) {
          if (Ci(l, u, f, h, t, i, n))
            return !0;
        } else
          s += je(l, u, f, h, i, n);
        l = f, u = h;
        break;
    }
  }
  return !e && !Tb(u, h) && (s += je(l, u, f, h, i, n) || 0), s !== 0;
}
function Ib(r, t, e) {
  return py(r, 0, !1, t, e);
}
function Lb(r, t, e, i) {
  return py(r, t, !0, e, i);
}
var dy = at({
  fill: "#000",
  stroke: null,
  strokePercent: 1,
  fillOpacity: 1,
  strokeOpacity: 1,
  lineDashOffset: 0,
  lineWidth: 1,
  lineCap: "butt",
  miterLimit: 10,
  strokeNoScale: !1,
  strokeFirst: !1
}, li), Pb = {
  style: at({
    fill: !0,
    stroke: !0,
    strokePercent: !0,
    fillOpacity: !0,
    strokeOpacity: !0,
    lineDashOffset: !0,
    lineWidth: !0,
    miterLimit: !0
  }, Ds.style)
}, El = ra.concat([
  "invisible",
  "culling",
  "z",
  "z2",
  "zlevel",
  "parent"
]), ot = (function(r) {
  ut(t, r);
  function t(e) {
    return r.call(this, e) || this;
  }
  return t.prototype.update = function() {
    var e = this;
    r.prototype.update.call(this);
    var i = this.style;
    if (i.decal) {
      var n = this._decalEl = this._decalEl || new t();
      n.buildPath === t.prototype.buildPath && (n.buildPath = function(l) {
        e.buildPath(l, e.shape);
      }), n.silent = !0;
      var a = n.style;
      for (var o in i)
        a[o] !== i[o] && (a[o] = i[o]);
      a.fill = i.fill ? i.decal : null, a.decal = null, a.shadowColor = null, i.strokeFirst && (a.stroke = null);
      for (var s = 0; s < El.length; ++s)
        n[El[s]] = this[El[s]];
      n.__dirty |= te;
    } else this._decalEl && (this._decalEl = null);
  }, t.prototype.getDecalElement = function() {
    return this._decalEl;
  }, t.prototype._init = function(e) {
    var i = ct(e);
    this.shape = this.getDefaultShape();
    var n = this.getDefaultStyle();
    n && this.useStyle(n);
    for (var a = 0; a < i.length; a++) {
      var o = i[a], s = e[o];
      o === "style" ? this.style ? k(this.style, s) : this.useStyle(s) : o === "shape" ? k(this.shape, s) : r.prototype.attrKV.call(this, o, s);
    }
    this.style || this.useStyle({});
  }, t.prototype.getDefaultStyle = function() {
    return null;
  }, t.prototype.getDefaultShape = function() {
    return {};
  }, t.prototype.canBeInsideText = function() {
    return this.hasFill();
  }, t.prototype.getInsideTextFill = function() {
    var e = this.style.fill;
    if (e !== "none") {
      if (V(e)) {
        var i = ea(e, 0);
        return i > 0.5 ? Zu : i > 0.2 ? sS : qu;
      } else if (e)
        return qu;
    }
    return Zu;
  }, t.prototype.getInsideTextStroke = function(e) {
    var i = this.style.fill;
    if (V(i)) {
      var n = this.__zr, a = !!(n && n.isDarkMode()), o = ea(e, 0) < $u;
      if (a === o)
        return i;
    }
  }, t.prototype.buildPath = function(e, i, n) {
  }, t.prototype.pathUpdated = function() {
    this.__dirty &= ~zi;
  }, t.prototype.getUpdatedPathProxy = function(e) {
    return !this.path && this.createPathProxy(), this.path.beginPath(), this.buildPath(this.path, this.shape, e), this.path;
  }, t.prototype.createPathProxy = function() {
    this.path = new pi(!1);
  }, t.prototype.hasStroke = function() {
    var e = this.style, i = e.stroke;
    return !(i == null || i === "none" || !(e.lineWidth > 0));
  }, t.prototype.hasFill = function() {
    var e = this.style, i = e.fill;
    return i != null && i !== "none";
  }, t.prototype.getBoundingRect = function() {
    var e = this._rect, i = this.style, n = !e;
    if (n) {
      var a = !1;
      this.path || (a = !0, this.createPathProxy());
      var o = this.path;
      (a || this.__dirty & zi) && (o.beginPath(), this.buildPath(o, this.shape, !1), this.pathUpdated()), e = o.getBoundingRect();
    }
    if (this._rect = e, this.hasStroke() && this.path && this.path.len() > 0) {
      var s = this._rectStroke || (this._rectStroke = e.clone());
      if (this.__dirty || n) {
        s.copy(e);
        var l = i.strokeNoScale ? this.getLineScale() : 1, u = i.lineWidth;
        if (!this.hasFill()) {
          var f = this.strokeContainThreshold;
          u = Math.max(u, f ?? 4);
        }
        l > 1e-10 && (s.width += u / l, s.height += u / l, s.x -= u / l / 2, s.y -= u / l / 2);
      }
      return s;
    }
    return e;
  }, t.prototype.contain = function(e, i) {
    var n = this.transformCoordToLocal(e, i), a = this.getBoundingRect(), o = this.style;
    if (e = n[0], i = n[1], a.contain(e, i)) {
      var s = this.path;
      if (this.hasStroke()) {
        var l = o.lineWidth, u = o.strokeNoScale ? this.getLineScale() : 1;
        if (u > 1e-10 && (this.hasFill() || (l = Math.max(l, this.strokeContainThreshold)), Lb(s, l / u, e, i)))
          return !0;
      }
      if (this.hasFill())
        return Ib(s, e, i);
    }
    return !1;
  }, t.prototype.dirtyShape = function() {
    this.__dirty |= zi, this._rect && (this._rect = null), this._decalEl && this._decalEl.dirtyShape(), this.markRedraw();
  }, t.prototype.dirty = function() {
    this.dirtyStyle(), this.dirtyShape();
  }, t.prototype.animateShape = function(e) {
    return this.animate("shape", e);
  }, t.prototype.updateDuringAnimation = function(e) {
    e === "style" ? this.dirtyStyle() : e === "shape" ? this.dirtyShape() : this.markRedraw();
  }, t.prototype.attrKV = function(e, i) {
    e === "shape" ? this.setShape(i) : r.prototype.attrKV.call(this, e, i);
  }, t.prototype.setShape = function(e, i) {
    var n = this.shape;
    return n || (n = this.shape = {}), typeof e == "string" ? n[e] = i : k(n, e), this.dirtyShape(), this;
  }, t.prototype.shapeChanged = function() {
    return !!(this.__dirty & zi);
  }, t.prototype.createStyle = function(e) {
    return Sa(dy, e);
  }, t.prototype._innerSaveToNormal = function(e) {
    r.prototype._innerSaveToNormal.call(this, e);
    var i = this._normalState;
    e.shape && !i.shape && (i.shape = k({}, this.shape));
  }, t.prototype._applyStateObj = function(e, i, n, a, o, s) {
    r.prototype._applyStateObj.call(this, e, i, n, a, o, s);
    var l = !(i && a), u;
    if (i && i.shape ? o ? a ? u = i.shape : (u = k({}, n.shape), k(u, i.shape)) : (u = k({}, a ? this.shape : n.shape), k(u, i.shape)) : l && (u = n.shape), u)
      if (o) {
        this.shape = k({}, this.shape);
        for (var f = {}, h = ct(u), c = 0; c < h.length; c++) {
          var v = h[c];
          typeof u[v] == "object" ? this.shape[v] = u[v] : f[v] = u[v];
        }
        this._transitionState(e, {
          shape: f
        }, s);
      } else
        this.shape = u, this.dirtyShape();
  }, t.prototype._mergeStates = function(e) {
    for (var i = r.prototype._mergeStates.call(this, e), n, a = 0; a < e.length; a++) {
      var o = e[a];
      o.shape && (n = n || {}, this._mergeStyle(n, o.shape));
    }
    return n && (i.shape = n), i;
  }, t.prototype.getAnimationStyleProps = function() {
    return Pb;
  }, t.prototype.isZeroArea = function() {
    return !1;
  }, t.extend = function(e) {
    var i = (function(a) {
      ut(o, a);
      function o(s) {
        var l = a.call(this, s) || this;
        return e.init && e.init.call(l, s), l;
      }
      return o.prototype.getDefaultStyle = function() {
        return U(e.style);
      }, o.prototype.getDefaultShape = function() {
        return U(e.shape);
      }, o;
    })(t);
    for (var n in e)
      typeof e[n] == "function" && (i.prototype[n] = e[n]);
    return i;
  }, t.initDefaultProps = (function() {
    var e = t.prototype;
    e.type = "path", e.strokeContainThreshold = 5, e.segmentIgnoreThreshold = 0, e.subPixelOptimize = !1, e.autoBatch = !1, e.__dirty = te | Pn | zi;
  })(), t;
})(Ma), Rb = at({
  strokeFirst: !0,
  font: vi,
  x: 0,
  y: 0,
  textAlign: "left",
  textBaseline: "top",
  miterLimit: 2
}, dy), jo = (function(r) {
  ut(t, r);
  function t() {
    return r !== null && r.apply(this, arguments) || this;
  }
  return t.prototype.hasStroke = function() {
    var e = this.style, i = e.stroke;
    return i != null && i !== "none" && e.lineWidth > 0;
  }, t.prototype.hasFill = function() {
    var e = this.style, i = e.fill;
    return i != null && i !== "none";
  }, t.prototype.createStyle = function(e) {
    return Sa(Rb, e);
  }, t.prototype.setBoundingRect = function(e) {
    this._rect = e;
  }, t.prototype.getBoundingRect = function() {
    var e = this.style;
    if (!this._rect) {
      var i = e.text;
      i != null ? i += "" : i = "";
      var n = oh(i, e.font, e.textAlign, e.textBaseline);
      if (n.x += e.x || 0, n.y += e.y || 0, this.hasStroke()) {
        var a = e.lineWidth;
        n.x -= a / 2, n.y -= a / 2, n.width += a, n.height += a;
      }
      this._rect = n;
    }
    return this._rect;
  }, t.initDefaultProps = (function() {
    var e = t.prototype;
    e.dirtyRectTolerance = 10;
  })(), t;
})(Ma);
jo.prototype.type = "tspan";
var Eb = at({
  x: 0,
  y: 0
}, li), Ob = {
  style: at({
    x: !0,
    y: !0,
    width: !0,
    height: !0,
    sx: !0,
    sy: !0,
    sWidth: !0,
    sHeight: !0
  }, Ds.style)
};
function kb(r) {
  return !!(r && typeof r != "string" && r.width && r.height);
}
var ke = (function(r) {
  ut(t, r);
  function t() {
    return r !== null && r.apply(this, arguments) || this;
  }
  return t.prototype.createStyle = function(e) {
    return Sa(Eb, e);
  }, t.prototype._getSize = function(e) {
    var i = this.style, n = i[e];
    if (n != null)
      return n;
    var a = kb(i.image) ? i.image : this.__image;
    if (!a)
      return 0;
    var o = e === "width" ? "height" : "width", s = i[o];
    return s == null ? a[e] : a[e] / a[o] * s;
  }, t.prototype.getWidth = function() {
    return this._getSize("width");
  }, t.prototype.getHeight = function() {
    return this._getSize("height");
  }, t.prototype.getAnimationStyleProps = function() {
    return Ob;
  }, t.prototype.getBoundingRect = function() {
    var e = this.style;
    return this._rect || (this._rect = new it(e.x || 0, e.y || 0, this.getWidth(), this.getHeight())), this._rect;
  }, t;
})(Ma);
ke.prototype.type = "image";
function Nb(r, t) {
  var e = t.x, i = t.y, n = t.width, a = t.height, o = t.r, s, l, u, f;
  n < 0 && (e = e + n, n = -n), a < 0 && (i = i + a, a = -a), typeof o == "number" ? s = l = u = f = o : o instanceof Array ? o.length === 1 ? s = l = u = f = o[0] : o.length === 2 ? (s = u = o[0], l = f = o[1]) : o.length === 3 ? (s = o[0], l = f = o[1], u = o[2]) : (s = o[0], l = o[1], u = o[2], f = o[3]) : s = l = u = f = 0;
  var h;
  s + l > n && (h = s + l, s *= n / h, l *= n / h), u + f > n && (h = u + f, u *= n / h, f *= n / h), l + u > a && (h = l + u, l *= a / h, u *= a / h), s + f > a && (h = s + f, s *= a / h, f *= a / h), r.moveTo(e + s, i), r.lineTo(e + n - l, i), l !== 0 && r.arc(e + n - l, i + l, l, -Math.PI / 2, 0), r.lineTo(e + n, i + a - u), u !== 0 && r.arc(e + n - u, i + a - u, u, 0, Math.PI / 2), r.lineTo(e + f, i + a), f !== 0 && r.arc(e + f, i + a - f, f, Math.PI / 2, Math.PI), r.lineTo(e, i + s), s !== 0 && r.arc(e + s, i + s, s, Math.PI, Math.PI * 1.5);
}
var Hi = Math.round;
function gy(r, t, e) {
  if (t) {
    var i = t.x1, n = t.x2, a = t.y1, o = t.y2;
    r.x1 = i, r.x2 = n, r.y1 = a, r.y2 = o;
    var s = e && e.lineWidth;
    return s && (Hi(i * 2) === Hi(n * 2) && (r.x1 = r.x2 = ii(i, s, !0)), Hi(a * 2) === Hi(o * 2) && (r.y1 = r.y2 = ii(a, s, !0))), r;
  }
}
function yy(r, t, e) {
  if (t) {
    var i = t.x, n = t.y, a = t.width, o = t.height;
    r.x = i, r.y = n, r.width = a, r.height = o;
    var s = e && e.lineWidth;
    return s && (r.x = ii(i, s, !0), r.y = ii(n, s, !0), r.width = Math.max(ii(i + a, s, !1) - r.x, a === 0 ? 0 : 1), r.height = Math.max(ii(n + o, s, !1) - r.y, o === 0 ? 0 : 1)), r;
  }
}
function ii(r, t, e) {
  if (!t)
    return r;
  var i = Hi(r * 2);
  return (i + Hi(t)) % 2 === 0 ? i / 2 : (i + (e ? 1 : -1)) / 2;
}
var Bb = /* @__PURE__ */ (function() {
  function r() {
    this.x = 0, this.y = 0, this.width = 0, this.height = 0;
  }
  return r;
})(), zb = {}, dt = (function(r) {
  ut(t, r);
  function t(e) {
    return r.call(this, e) || this;
  }
  return t.prototype.getDefaultShape = function() {
    return new Bb();
  }, t.prototype.buildPath = function(e, i) {
    var n, a, o, s;
    if (this.subPixelOptimize) {
      var l = yy(zb, i, this.style);
      n = l.x, a = l.y, o = l.width, s = l.height, l.r = i.r, i = l;
    } else
      n = i.x, a = i.y, o = i.width, s = i.height;
    i.r ? Nb(e, i) : e.rect(n, a, o, s);
  }, t.prototype.isZeroArea = function() {
    return !this.shape.width || !this.shape.height;
  }, t;
})(ot);
dt.prototype.type = "rect";
var qv = {
  fill: "#000"
}, Kv = 2, Fb = {
  style: at({
    fill: !0,
    stroke: !0,
    fillOpacity: !0,
    strokeOpacity: !0,
    lineWidth: !0,
    fontSize: !0,
    lineHeight: !0,
    width: !0,
    height: !0,
    textShadowColor: !0,
    textShadowBlur: !0,
    textShadowOffsetX: !0,
    textShadowOffsetY: !0,
    backgroundColor: !0,
    padding: !0,
    borderColor: !0,
    borderWidth: !0,
    borderRadius: !0
  }, Ds.style)
}, mt = (function(r) {
  ut(t, r);
  function t(e) {
    var i = r.call(this) || this;
    return i.type = "text", i._children = [], i._defaultStyle = qv, i.attr(e), i;
  }
  return t.prototype.childrenRef = function() {
    return this._children;
  }, t.prototype.update = function() {
    r.prototype.update.call(this), this.styleChanged() && this._updateSubTexts();
    for (var e = 0; e < this._children.length; e++) {
      var i = this._children[e];
      i.zlevel = this.zlevel, i.z = this.z, i.z2 = this.z2, i.culling = this.culling, i.cursor = this.cursor, i.invisible = this.invisible;
    }
  }, t.prototype.updateTransform = function() {
    var e = this.innerTransformable;
    e ? (e.updateTransform(), e.transform && (this.transform = e.transform)) : r.prototype.updateTransform.call(this);
  }, t.prototype.getLocalTransform = function(e) {
    var i = this.innerTransformable;
    return i ? i.getLocalTransform(e) : r.prototype.getLocalTransform.call(this, e);
  }, t.prototype.getComputedTransform = function() {
    return this.__hostTarget && (this.__hostTarget.getComputedTransform(), this.__hostTarget.updateInnerText(!0)), r.prototype.getComputedTransform.call(this);
  }, t.prototype._updateSubTexts = function() {
    this._childCursor = 0, Ub(this.style), this.style.rich ? this._updateRichTexts() : this._updatePlainTexts(), this._children.length = this._childCursor, this.styleUpdated();
  }, t.prototype.addSelfToZr = function(e) {
    r.prototype.addSelfToZr.call(this, e);
    for (var i = 0; i < this._children.length; i++)
      this._children[i].__zr = e;
  }, t.prototype.removeSelfFromZr = function(e) {
    r.prototype.removeSelfFromZr.call(this, e);
    for (var i = 0; i < this._children.length; i++)
      this._children[i].__zr = null;
  }, t.prototype.getBoundingRect = function() {
    if (this.styleChanged() && this._updateSubTexts(), !this._rect) {
      for (var e = new it(0, 0, 0, 0), i = this._children, n = [], a = null, o = 0; o < i.length; o++) {
        var s = i[o], l = s.getBoundingRect(), u = s.getLocalTransform(n);
        u ? (e.copy(l), e.applyTransform(u), a = a || e.clone(), a.union(e)) : (a = a || l.clone(), a.union(l));
      }
      this._rect = a || e;
    }
    return this._rect;
  }, t.prototype.setDefaultTextStyle = function(e) {
    this._defaultStyle = e || qv;
  }, t.prototype.setTextContent = function(e) {
  }, t.prototype._mergeStyle = function(e, i) {
    if (!i)
      return e;
    var n = i.rich, a = e.rich || n && {};
    return k(e, i), n && a ? (this._mergeRich(a, n), e.rich = a) : a && (e.rich = a), e;
  }, t.prototype._mergeRich = function(e, i) {
    for (var n = ct(i), a = 0; a < n.length; a++) {
      var o = n[a];
      e[o] = e[o] || {}, k(e[o], i[o]);
    }
  }, t.prototype.getAnimationStyleProps = function() {
    return Fb;
  }, t.prototype._getOrCreateChild = function(e) {
    var i = this._children[this._childCursor];
    return (!i || !(i instanceof e)) && (i = new e()), this._children[this._childCursor++] = i, i.__zr = this.__zr, i.parent = this, i;
  }, t.prototype._updatePlainTexts = function() {
    var e = this.style, i = e.font || vi, n = e.padding, a = ic(e), o = sb(a, e), s = Ol(e), l = !!e.backgroundColor, u = o.outerHeight, f = o.outerWidth, h = o.contentWidth, c = o.lines, v = o.lineHeight, p = this._defaultStyle;
    this.isTruncated = !!o.isTruncated;
    var g = e.x || 0, d = e.y || 0, y = e.align || p.align || "left", m = e.verticalAlign || p.verticalAlign || "top", _ = g, S = Fi(d, o.contentHeight, m);
    if (s || n) {
      var w = En(g, f, y), b = Fi(d, u, m);
      s && this._renderBackground(e, e, w, b, f, u);
    }
    S += v / 2, n && (_ = rc(g, y, n), m === "top" ? S += n[0] : m === "bottom" && (S -= n[2]));
    for (var x = 0, M = !1, D = ec("fill" in e ? e.fill : (M = !0, p.fill)), A = tc("stroke" in e ? e.stroke : !l && (!p.autoStroke || M) ? (x = Kv, p.stroke) : null), C = e.textShadowBlur > 0, I = e.width != null && (e.overflow === "truncate" || e.overflow === "break" || e.overflow === "breakAll"), L = o.calculatedLineHeight, P = 0; P < c.length; P++) {
      var R = this._getOrCreateChild(jo), E = R.createStyle();
      R.useStyle(E), E.text = c[P], E.x = _, E.y = S, E.textAlign = y, E.textBaseline = "middle", E.opacity = e.opacity, E.strokeFirst = !0, C && (E.shadowBlur = e.textShadowBlur || 0, E.shadowColor = e.textShadowColor || "transparent", E.shadowOffsetX = e.textShadowOffsetX || 0, E.shadowOffsetY = e.textShadowOffsetY || 0), E.stroke = A, E.fill = D, A && (E.lineWidth = e.lineWidth || x, E.lineDash = e.lineDash, E.lineDashOffset = e.lineDashOffset || 0), E.font = i, Jv(E, e), S += v, I && R.setBoundingRect(new it(En(E.x, h, E.textAlign), Fi(E.y, L, E.textBaseline), h, L));
    }
  }, t.prototype._updateRichTexts = function() {
    var e = this.style, i = ic(e), n = fb(i, e), a = n.width, o = n.outerWidth, s = n.outerHeight, l = e.padding, u = e.x || 0, f = e.y || 0, h = this._defaultStyle, c = e.align || h.align, v = e.verticalAlign || h.verticalAlign;
    this.isTruncated = !!n.isTruncated;
    var p = En(u, o, c), g = Fi(f, s, v), d = p, y = g;
    l && (d += l[3], y += l[0]);
    var m = d + a;
    Ol(e) && this._renderBackground(e, e, p, g, o, s);
    for (var _ = !!e.backgroundColor, S = 0; S < n.lines.length; S++) {
      for (var w = n.lines[S], b = w.tokens, x = b.length, M = w.lineHeight, D = w.width, A = 0, C = d, I = m, L = x - 1, P = void 0; A < x && (P = b[A], !P.align || P.align === "left"); )
        this._placeToken(P, e, M, y, C, "left", _), D -= P.width, C += P.width, A++;
      for (; L >= 0 && (P = b[L], P.align === "right"); )
        this._placeToken(P, e, M, y, I, "right", _), D -= P.width, I -= P.width, L--;
      for (C += (a - (C - d) - (m - I) - D) / 2; A <= L; )
        P = b[A], this._placeToken(P, e, M, y, C + P.width / 2, "center", _), C += P.width, A++;
      y += M;
    }
  }, t.prototype._placeToken = function(e, i, n, a, o, s, l) {
    var u = i.rich[e.styleName] || {};
    u.text = e.text;
    var f = e.verticalAlign, h = a + n / 2;
    f === "top" ? h = a + e.height / 2 : f === "bottom" && (h = a + n - e.height / 2);
    var c = !e.isLineHolder && Ol(u);
    c && this._renderBackground(u, i, s === "right" ? o - e.width : s === "center" ? o - e.width / 2 : o, h - e.height / 2, e.width, e.height);
    var v = !!u.backgroundColor, p = e.textPadding;
    p && (o = rc(o, s, p), h -= e.height / 2 - p[0] - e.innerHeight / 2);
    var g = this._getOrCreateChild(jo), d = g.createStyle();
    g.useStyle(d);
    var y = this._defaultStyle, m = !1, _ = 0, S = ec("fill" in u ? u.fill : "fill" in i ? i.fill : (m = !0, y.fill)), w = tc("stroke" in u ? u.stroke : "stroke" in i ? i.stroke : !v && !l && (!y.autoStroke || m) ? (_ = Kv, y.stroke) : null), b = u.textShadowBlur > 0 || i.textShadowBlur > 0;
    d.text = e.text, d.x = o, d.y = h, b && (d.shadowBlur = u.textShadowBlur || i.textShadowBlur || 0, d.shadowColor = u.textShadowColor || i.textShadowColor || "transparent", d.shadowOffsetX = u.textShadowOffsetX || i.textShadowOffsetX || 0, d.shadowOffsetY = u.textShadowOffsetY || i.textShadowOffsetY || 0), d.textAlign = s, d.textBaseline = "middle", d.font = e.font || vi, d.opacity = zn(u.opacity, i.opacity, 1), Jv(d, u), w && (d.lineWidth = zn(u.lineWidth, i.lineWidth, _), d.lineDash = Z(u.lineDash, i.lineDash), d.lineDashOffset = i.lineDashOffset || 0, d.stroke = w), S && (d.fill = S);
    var x = e.contentWidth, M = e.contentHeight;
    g.setBoundingRect(new it(En(d.x, x, d.textAlign), Fi(d.y, M, d.textBaseline), x, M));
  }, t.prototype._renderBackground = function(e, i, n, a, o, s) {
    var l = e.backgroundColor, u = e.borderWidth, f = e.borderColor, h = l && l.image, c = l && !h, v = e.borderRadius, p = this, g, d;
    if (c || e.lineHeight || u && f) {
      g = this._getOrCreateChild(dt), g.useStyle(g.createStyle()), g.style.fill = null;
      var y = g.shape;
      y.x = n, y.y = a, y.width = o, y.height = s, y.r = v, g.dirtyShape();
    }
    if (c) {
      var m = g.style;
      m.fill = l || null, m.fillOpacity = Z(e.fillOpacity, 1);
    } else if (h) {
      d = this._getOrCreateChild(ke), d.onload = function() {
        p.dirtyStyle();
      };
      var _ = d.style;
      _.image = l.image, _.x = n, _.y = a, _.width = o, _.height = s;
    }
    if (u && f) {
      var m = g.style;
      m.lineWidth = u, m.stroke = f, m.strokeOpacity = Z(e.strokeOpacity, 1), m.lineDash = e.borderDash, m.lineDashOffset = e.borderDashOffset || 0, g.strokeContainThreshold = 0, g.hasFill() && g.hasStroke() && (m.strokeFirst = !0, m.lineWidth *= 2);
    }
    var S = (g || d).style;
    S.shadowBlur = e.shadowBlur || 0, S.shadowColor = e.shadowColor || "transparent", S.shadowOffsetX = e.shadowOffsetX || 0, S.shadowOffsetY = e.shadowOffsetY || 0, S.opacity = zn(e.opacity, i.opacity, 1);
  }, t.makeFont = function(e) {
    var i = "";
    return Wb(e) && (i = [
      e.fontStyle,
      e.fontWeight,
      Gb(e.fontSize),
      e.fontFamily || "sans-serif"
    ].join(" ")), i && Me(i) || e.textFont || e.font;
  }, t;
})(Ma), Vb = { left: !0, right: 1, center: 1 }, Hb = { top: 1, bottom: 1, middle: 1 }, Qv = ["fontStyle", "fontWeight", "fontSize", "fontFamily"];
function Gb(r) {
  return typeof r == "string" && (r.indexOf("px") !== -1 || r.indexOf("rem") !== -1 || r.indexOf("em") !== -1) ? r : isNaN(+r) ? Yf + "px" : r + "px";
}
function Jv(r, t) {
  for (var e = 0; e < Qv.length; e++) {
    var i = Qv[e], n = t[i];
    n != null && (r[i] = n);
  }
}
function Wb(r) {
  return r.fontSize != null || r.fontFamily || r.fontWeight;
}
function Ub(r) {
  return jv(r), T(r.rich, jv), r;
}
function jv(r) {
  if (r) {
    r.font = mt.makeFont(r);
    var t = r.align;
    t === "middle" && (t = "center"), r.align = t == null || Vb[t] ? t : "left";
    var e = r.verticalAlign;
    e === "center" && (e = "middle"), r.verticalAlign = e == null || Hb[e] ? e : "top";
    var i = r.padding;
    i && (r.padding = Kf(r.padding));
  }
}
function tc(r, t) {
  return r == null || t <= 0 || r === "transparent" || r === "none" ? null : r.image || r.colorStops ? "#000" : r;
}
function ec(r) {
  return r == null || r === "none" ? null : r.image || r.colorStops ? "#000" : r;
}
function rc(r, t, e) {
  return t === "right" ? r - e[1] : t === "center" ? r + e[3] / 2 - e[1] / 2 : r + e[3];
}
function ic(r) {
  var t = r.text;
  return t != null && (t += ""), t;
}
function Ol(r) {
  return !!(r.backgroundColor || r.lineHeight || r.borderWidth && r.borderColor);
}
var J = bt(), Yb = function(r, t, e, i) {
  if (i) {
    var n = J(i);
    n.dataIndex = e, n.dataType = t, n.seriesIndex = r, n.ssrType = "chart", i.type === "group" && i.traverse(function(a) {
      var o = J(a);
      o.seriesIndex = r, o.dataIndex = e, o.dataType = t, o.ssrType = "chart";
    });
  }
}, nc = 1, ac = {}, my = bt(), ph = bt(), dh = 0, As = 1, Is = 2, de = ["emphasis", "blur", "select"], oc = ["normal", "emphasis", "blur", "select"], Xb = 10, $b = 9, ui = "highlight", ko = "downplay", Gn = "select", No = "unselect", Wn = "toggleSelect";
function Mi(r) {
  return r != null && r !== "none";
}
function Ls(r, t, e) {
  r.onHoverStateChange && (r.hoverState || 0) !== e && r.onHoverStateChange(t), r.hoverState = e;
}
function _y(r) {
  Ls(r, "emphasis", Is);
}
function Sy(r) {
  r.hoverState === Is && Ls(r, "normal", dh);
}
function gh(r) {
  Ls(r, "blur", As);
}
function by(r) {
  r.hoverState === As && Ls(r, "normal", dh);
}
function Zb(r) {
  r.selected = !0;
}
function qb(r) {
  r.selected = !1;
}
function sc(r, t, e) {
  t(r, e);
}
function ir(r, t, e) {
  sc(r, t, e), r.isGroup && r.traverse(function(i) {
    sc(i, t, e);
  });
}
function lc(r, t) {
  switch (t) {
    case "emphasis":
      r.hoverState = Is;
      break;
    case "normal":
      r.hoverState = dh;
      break;
    case "blur":
      r.hoverState = As;
      break;
    case "select":
      r.selected = !0;
  }
}
function Kb(r, t, e, i) {
  for (var n = r.style, a = {}, o = 0; o < t.length; o++) {
    var s = t[o], l = n[s];
    a[s] = l ?? (i && i[s]);
  }
  for (var o = 0; o < r.animators.length; o++) {
    var u = r.animators[o];
    u.__fromStateTransition && u.__fromStateTransition.indexOf(e) < 0 && u.targetName === "style" && u.saveTo(a, t);
  }
  return a;
}
function Qb(r, t, e, i) {
  var n = e && nt(e, "select") >= 0, a = !1;
  if (r instanceof ot) {
    var o = my(r), s = n && o.selectFill || o.normalFill, l = n && o.selectStroke || o.normalStroke;
    if (Mi(s) || Mi(l)) {
      i = i || {};
      var u = i.style || {};
      u.fill === "inherit" ? (a = !0, i = k({}, i), u = k({}, u), u.fill = s) : !Mi(u.fill) && Mi(s) ? (a = !0, i = k({}, i), u = k({}, u), u.fill = Hu(s)) : !Mi(u.stroke) && Mi(l) && (a || (i = k({}, i), u = k({}, u)), u.stroke = Hu(l)), i.style = u;
    }
  }
  if (i && i.z2 == null) {
    a || (i = k({}, i));
    var f = r.z2EmphasisLift;
    i.z2 = r.z2 + (f ?? Xb);
  }
  return i;
}
function Jb(r, t, e) {
  if (e && e.z2 == null) {
    e = k({}, e);
    var i = r.z2SelectLift;
    e.z2 = r.z2 + (i ?? $b);
  }
  return e;
}
function jb(r, t, e) {
  var i = nt(r.currentStates, t) >= 0, n = r.style.opacity, a = i ? null : Kb(r, ["opacity"], t, {
    opacity: 1
  });
  e = e || {};
  var o = e.style || {};
  return o.opacity == null && (e = k({}, e), o = k({
    // Already being applied 'emphasis'. DON'T mul opacity multiple times.
    opacity: i ? n : a.opacity * 0.1
  }, o), e.style = o), e;
}
function kl(r, t) {
  var e = this.states[r];
  if (this.style) {
    if (r === "emphasis")
      return Qb(this, r, t, e);
    if (r === "blur")
      return jb(this, r, e);
    if (r === "select")
      return Jb(this, r, e);
  }
  return e;
}
function tw(r) {
  r.stateProxy = kl;
  var t = r.getTextContent(), e = r.getTextGuideLine();
  t && (t.stateProxy = kl), e && (e.stateProxy = kl);
}
function uc(r, t) {
  !Cy(r, t) && !r.__highByOuter && ir(r, _y);
}
function fc(r, t) {
  !Cy(r, t) && !r.__highByOuter && ir(r, Sy);
}
function sa(r, t) {
  r.__highByOuter |= 1 << (t || 0), ir(r, _y);
}
function la(r, t) {
  !(r.__highByOuter &= ~(1 << (t || 0))) && ir(r, Sy);
}
function wy(r) {
  ir(r, gh);
}
function yh(r) {
  ir(r, by);
}
function xy(r) {
  ir(r, Zb);
}
function Ty(r) {
  ir(r, qb);
}
function Cy(r, t) {
  return r.__highDownSilentOnTouch && t.zrByTouch;
}
function My(r) {
  var t = r.getModel(), e = [], i = [];
  t.eachComponent(function(n, a) {
    var o = ph(a), s = n === "series", l = s ? r.getViewOfSeriesModel(a) : r.getViewOfComponentModel(a);
    !s && i.push(l), o.isBlured && (l.group.traverse(function(u) {
      by(u);
    }), s && e.push(a)), o.isBlured = !1;
  }), T(i, function(n) {
    n && n.toggleBlurSeries && n.toggleBlurSeries(e, !1, t);
  });
}
function nf(r, t, e, i) {
  var n = i.getModel();
  e = e || "coordinateSystem";
  function a(u, f) {
    for (var h = 0; h < f.length; h++) {
      var c = u.getItemGraphicEl(f[h]);
      c && yh(c);
    }
  }
  if (r != null && !(!t || t === "none")) {
    var o = n.getSeriesByIndex(r), s = o.coordinateSystem;
    s && s.master && (s = s.master);
    var l = [];
    n.eachSeries(function(u) {
      var f = o === u, h = u.coordinateSystem;
      h && h.master && (h = h.master);
      var c = h && s ? h === s : f;
      if (!// Not blur other series if blurScope series
      (e === "series" && !f || e === "coordinateSystem" && !c || t === "series" && f)) {
        var v = i.getViewOfSeriesModel(u);
        if (v.group.traverse(function(d) {
          d.__highByOuter && f && t === "self" || gh(d);
        }), Ht(t))
          a(u.getData(), t);
        else if (H(t))
          for (var p = ct(t), g = 0; g < p.length; g++)
            a(u.getData(p[g]), t[p[g]]);
        l.push(u), ph(u).isBlured = !0;
      }
    }), n.eachComponent(function(u, f) {
      if (u !== "series") {
        var h = i.getViewOfComponentModel(f);
        h && h.toggleBlurSeries && h.toggleBlurSeries(l, !0, n);
      }
    });
  }
}
function af(r, t, e) {
  if (!(r == null || t == null)) {
    var i = e.getModel().getComponent(r, t);
    if (i) {
      ph(i).isBlured = !0;
      var n = e.getViewOfComponentModel(i);
      !n || !n.focusBlurEnabled || n.group.traverse(function(a) {
        gh(a);
      });
    }
  }
}
function ew(r, t, e) {
  var i = r.seriesIndex, n = r.getData(t.dataType);
  if (n) {
    var a = ci(n, t);
    a = (O(a) ? a[0] : a) || 0;
    var o = n.getItemGraphicEl(a);
    if (!o)
      for (var s = n.count(), l = 0; !o && l < s; )
        o = n.getItemGraphicEl(l++);
    if (o) {
      var u = J(o);
      nf(i, u.focus, u.blurScope, e);
    } else {
      var f = r.get(["emphasis", "focus"]), h = r.get(["emphasis", "blurScope"]);
      f != null && nf(i, f, h, e);
    }
  }
}
function mh(r, t, e, i) {
  var n = {
    focusSelf: !1,
    dispatchers: null
  };
  if (r == null || r === "series" || t == null || e == null)
    return n;
  var a = i.getModel().getComponent(r, t);
  if (!a)
    return n;
  var o = i.getViewOfComponentModel(a);
  if (!o || !o.findHighDownDispatchers)
    return n;
  for (var s = o.findHighDownDispatchers(e), l, u = 0; u < s.length; u++)
    if (J(s[u]).focus === "self") {
      l = !0;
      break;
    }
  return {
    focusSelf: l,
    dispatchers: s
  };
}
function rw(r, t, e) {
  var i = J(r), n = mh(i.componentMainType, i.componentIndex, i.componentHighDownName, e), a = n.dispatchers, o = n.focusSelf;
  a ? (o && af(i.componentMainType, i.componentIndex, e), T(a, function(s) {
    return uc(s, t);
  })) : (nf(i.seriesIndex, i.focus, i.blurScope, e), i.focus === "self" && af(i.componentMainType, i.componentIndex, e), uc(r, t));
}
function iw(r, t, e) {
  My(e);
  var i = J(r), n = mh(i.componentMainType, i.componentIndex, i.componentHighDownName, e).dispatchers;
  n ? T(n, function(a) {
    return fc(a, t);
  }) : fc(r, t);
}
function nw(r, t, e) {
  if (lf(t)) {
    var i = t.dataType, n = r.getData(i), a = ci(n, t);
    O(a) || (a = [a]), r[t.type === Wn ? "toggleSelect" : t.type === Gn ? "select" : "unselect"](a, i);
  }
}
function hc(r) {
  var t = r.getAllData();
  T(t, function(e) {
    var i = e.data, n = e.type;
    i.eachItemGraphicEl(function(a, o) {
      r.isSelected(o, n) ? xy(a) : Ty(a);
    });
  });
}
function aw(r) {
  var t = [];
  return r.eachSeries(function(e) {
    var i = e.getAllData();
    T(i, function(n) {
      n.data;
      var a = n.type, o = e.getSelectedDataIndices();
      if (o.length > 0) {
        var s = {
          dataIndex: o,
          seriesIndex: e.seriesIndex
        };
        a != null && (s.dataType = a), t.push(s);
      }
    });
  }), t;
}
function ts(r, t, e) {
  _h(r, !0), ir(r, tw), sw(r, t, e);
}
function ow(r) {
  _h(r, !1);
}
function Ji(r, t, e, i) {
  i ? ow(r) : ts(r, t, e);
}
function sw(r, t, e) {
  var i = J(r);
  t != null ? (i.focus = t, i.blurScope = e) : i.focus && (i.focus = null);
}
var vc = ["emphasis", "blur", "select"], lw = {
  itemStyle: "getItemStyle",
  lineStyle: "getLineStyle",
  areaStyle: "getAreaStyle"
};
function of(r, t, e, i) {
  e = e || "itemStyle";
  for (var n = 0; n < vc.length; n++) {
    var a = vc[n], o = t.getModel([a, e]), s = r.ensureState(a);
    s.style = o[lw[e]]();
  }
}
function _h(r, t) {
  var e = t === !1, i = r;
  r.highDownSilentOnTouch && (i.__highDownSilentOnTouch = r.highDownSilentOnTouch), (!e || i.__highDownDispatcher) && (i.__highByOuter = i.__highByOuter || 0, i.__highDownDispatcher = !e);
}
function sf(r) {
  return !!(r && r.__highDownDispatcher);
}
function uw(r) {
  var t = ac[r];
  return t == null && nc <= 32 && (t = ac[r] = nc++), t;
}
function lf(r) {
  var t = r.type;
  return t === Gn || t === No || t === Wn;
}
function cc(r) {
  var t = r.type;
  return t === ui || t === ko;
}
function fw(r) {
  var t = my(r);
  t.normalFill = r.style.fill, t.normalStroke = r.style.stroke;
  var e = r.states.select || {};
  t.selectFill = e.style && e.style.fill || null, t.selectStroke = e.style && e.style.stroke || null;
}
var Di = pi.CMD, hw = [[], [], []], pc = Math.sqrt, vw = Math.atan2;
function cw(r, t) {
  if (t) {
    var e = r.data, i = r.len(), n, a, o, s, l, u, f = Di.M, h = Di.C, c = Di.L, v = Di.R, p = Di.A, g = Di.Q;
    for (o = 0, s = 0; o < i; ) {
      switch (n = e[o++], s = o, a = 0, n) {
        case f:
          a = 1;
          break;
        case c:
          a = 1;
          break;
        case h:
          a = 3;
          break;
        case g:
          a = 2;
          break;
        case p:
          var d = t[4], y = t[5], m = pc(t[0] * t[0] + t[1] * t[1]), _ = pc(t[2] * t[2] + t[3] * t[3]), S = vw(-t[1] / _, t[0] / m);
          e[o] *= m, e[o++] += d, e[o] *= _, e[o++] += y, e[o++] *= m, e[o++] *= _, e[o++] += S, e[o++] += S, o += 2, s = o;
          break;
        case v:
          u[0] = e[o++], u[1] = e[o++], Vt(u, u, t), e[s++] = u[0], e[s++] = u[1], u[0] += e[o++], u[1] += e[o++], Vt(u, u, t), e[s++] = u[0], e[s++] = u[1];
      }
      for (l = 0; l < a; l++) {
        var w = hw[l];
        w[0] = e[o++], w[1] = e[o++], Vt(w, w, t), e[s++] = w[0], e[s++] = w[1];
      }
    }
    r.increaseVersion();
  }
}
var Nl = Math.sqrt, Za = Math.sin, qa = Math.cos, yn = Math.PI;
function dc(r) {
  return Math.sqrt(r[0] * r[0] + r[1] * r[1]);
}
function uf(r, t) {
  return (r[0] * t[0] + r[1] * t[1]) / (dc(r) * dc(t));
}
function gc(r, t) {
  return (r[0] * t[1] < r[1] * t[0] ? -1 : 1) * Math.acos(uf(r, t));
}
function yc(r, t, e, i, n, a, o, s, l, u, f) {
  var h = l * (yn / 180), c = qa(h) * (r - e) / 2 + Za(h) * (t - i) / 2, v = -1 * Za(h) * (r - e) / 2 + qa(h) * (t - i) / 2, p = c * c / (o * o) + v * v / (s * s);
  p > 1 && (o *= Nl(p), s *= Nl(p));
  var g = (n === a ? -1 : 1) * Nl((o * o * (s * s) - o * o * (v * v) - s * s * (c * c)) / (o * o * (v * v) + s * s * (c * c))) || 0, d = g * o * v / s, y = g * -s * c / o, m = (r + e) / 2 + qa(h) * d - Za(h) * y, _ = (t + i) / 2 + Za(h) * d + qa(h) * y, S = gc([1, 0], [(c - d) / o, (v - y) / s]), w = [(c - d) / o, (v - y) / s], b = [(-1 * c - d) / o, (-1 * v - y) / s], x = gc(w, b);
  if (uf(w, b) <= -1 && (x = yn), uf(w, b) >= 1 && (x = 0), x < 0) {
    var M = Math.round(x / yn * 1e6) / 1e6;
    x = yn * 2 + M % 2 * yn;
  }
  f.addData(u, m, _, o, s, S, x, h, a);
}
var pw = /([mlvhzcqtsa])([^mlvhzcqtsa]*)/ig, dw = /-?([0-9]*\.)?[0-9]+([eE]-?[0-9]+)?/g;
function gw(r) {
  var t = new pi();
  if (!r)
    return t;
  var e = 0, i = 0, n = e, a = i, o, s = pi.CMD, l = r.match(pw);
  if (!l)
    return t;
  for (var u = 0; u < l.length; u++) {
    for (var f = l[u], h = f.charAt(0), c = void 0, v = f.match(dw) || [], p = v.length, g = 0; g < p; g++)
      v[g] = parseFloat(v[g]);
    for (var d = 0; d < p; ) {
      var y = void 0, m = void 0, _ = void 0, S = void 0, w = void 0, b = void 0, x = void 0, M = e, D = i, A = void 0, C = void 0;
      switch (h) {
        case "l":
          e += v[d++], i += v[d++], c = s.L, t.addData(c, e, i);
          break;
        case "L":
          e = v[d++], i = v[d++], c = s.L, t.addData(c, e, i);
          break;
        case "m":
          e += v[d++], i += v[d++], c = s.M, t.addData(c, e, i), n = e, a = i, h = "l";
          break;
        case "M":
          e = v[d++], i = v[d++], c = s.M, t.addData(c, e, i), n = e, a = i, h = "L";
          break;
        case "h":
          e += v[d++], c = s.L, t.addData(c, e, i);
          break;
        case "H":
          e = v[d++], c = s.L, t.addData(c, e, i);
          break;
        case "v":
          i += v[d++], c = s.L, t.addData(c, e, i);
          break;
        case "V":
          i = v[d++], c = s.L, t.addData(c, e, i);
          break;
        case "C":
          c = s.C, t.addData(c, v[d++], v[d++], v[d++], v[d++], v[d++], v[d++]), e = v[d - 2], i = v[d - 1];
          break;
        case "c":
          c = s.C, t.addData(c, v[d++] + e, v[d++] + i, v[d++] + e, v[d++] + i, v[d++] + e, v[d++] + i), e += v[d - 2], i += v[d - 1];
          break;
        case "S":
          y = e, m = i, A = t.len(), C = t.data, o === s.C && (y += e - C[A - 4], m += i - C[A - 3]), c = s.C, M = v[d++], D = v[d++], e = v[d++], i = v[d++], t.addData(c, y, m, M, D, e, i);
          break;
        case "s":
          y = e, m = i, A = t.len(), C = t.data, o === s.C && (y += e - C[A - 4], m += i - C[A - 3]), c = s.C, M = e + v[d++], D = i + v[d++], e += v[d++], i += v[d++], t.addData(c, y, m, M, D, e, i);
          break;
        case "Q":
          M = v[d++], D = v[d++], e = v[d++], i = v[d++], c = s.Q, t.addData(c, M, D, e, i);
          break;
        case "q":
          M = v[d++] + e, D = v[d++] + i, e += v[d++], i += v[d++], c = s.Q, t.addData(c, M, D, e, i);
          break;
        case "T":
          y = e, m = i, A = t.len(), C = t.data, o === s.Q && (y += e - C[A - 4], m += i - C[A - 3]), e = v[d++], i = v[d++], c = s.Q, t.addData(c, y, m, e, i);
          break;
        case "t":
          y = e, m = i, A = t.len(), C = t.data, o === s.Q && (y += e - C[A - 4], m += i - C[A - 3]), e += v[d++], i += v[d++], c = s.Q, t.addData(c, y, m, e, i);
          break;
        case "A":
          _ = v[d++], S = v[d++], w = v[d++], b = v[d++], x = v[d++], M = e, D = i, e = v[d++], i = v[d++], c = s.A, yc(M, D, e, i, b, x, _, S, w, c, t);
          break;
        case "a":
          _ = v[d++], S = v[d++], w = v[d++], b = v[d++], x = v[d++], M = e, D = i, e += v[d++], i += v[d++], c = s.A, yc(M, D, e, i, b, x, _, S, w, c, t);
          break;
      }
    }
    (h === "z" || h === "Z") && (c = s.Z, t.addData(c), e = n, i = a), o = c;
  }
  return t.toStatic(), t;
}
var Dy = (function(r) {
  ut(t, r);
  function t() {
    return r !== null && r.apply(this, arguments) || this;
  }
  return t.prototype.applyTransform = function(e) {
  }, t;
})(ot);
function Ay(r) {
  return r.setData != null;
}
function Iy(r, t) {
  var e = gw(r), i = k({}, t);
  return i.buildPath = function(n) {
    if (Ay(n)) {
      n.setData(e.data);
      var a = n.getContext();
      a && n.rebuildPath(a, 1);
    } else {
      var a = n;
      e.rebuildPath(a, 1);
    }
  }, i.applyTransform = function(n) {
    cw(e, n), this.dirtyShape();
  }, i;
}
function yw(r, t) {
  return new Dy(Iy(r, t));
}
function mw(r, t) {
  var e = Iy(r, t), i = (function(n) {
    ut(a, n);
    function a(o) {
      var s = n.call(this, o) || this;
      return s.applyTransform = e.applyTransform, s.buildPath = e.buildPath, s;
    }
    return a;
  })(Dy);
  return i;
}
function _w(r, t) {
  for (var e = [], i = r.length, n = 0; n < i; n++) {
    var a = r[n];
    e.push(a.getUpdatedPathProxy(!0));
  }
  var o = new ot(t);
  return o.createPathProxy(), o.buildPath = function(s) {
    if (Ay(s)) {
      s.appendPath(e);
      var l = s.getContext();
      l && s.rebuildPath(l, 1);
    }
  }, o;
}
var Sw = /* @__PURE__ */ (function() {
  function r() {
    this.cx = 0, this.cy = 0, this.r = 0;
  }
  return r;
})(), Da = (function(r) {
  ut(t, r);
  function t(e) {
    return r.call(this, e) || this;
  }
  return t.prototype.getDefaultShape = function() {
    return new Sw();
  }, t.prototype.buildPath = function(e, i) {
    e.moveTo(i.cx + i.r, i.cy), e.arc(i.cx, i.cy, i.r, 0, Math.PI * 2);
  }, t;
})(ot);
Da.prototype.type = "circle";
var bw = /* @__PURE__ */ (function() {
  function r() {
    this.cx = 0, this.cy = 0, this.rx = 0, this.ry = 0;
  }
  return r;
})(), Ps = (function(r) {
  ut(t, r);
  function t(e) {
    return r.call(this, e) || this;
  }
  return t.prototype.getDefaultShape = function() {
    return new bw();
  }, t.prototype.buildPath = function(e, i) {
    var n = 0.5522848, a = i.cx, o = i.cy, s = i.rx, l = i.ry, u = s * n, f = l * n;
    e.moveTo(a - s, o), e.bezierCurveTo(a - s, o - f, a - u, o - l, a, o - l), e.bezierCurveTo(a + u, o - l, a + s, o - f, a + s, o), e.bezierCurveTo(a + s, o + f, a + u, o + l, a, o + l), e.bezierCurveTo(a - u, o + l, a - s, o + f, a - s, o), e.closePath();
  }, t;
})(ot);
Ps.prototype.type = "ellipse";
var Ly = Math.PI, Bl = Ly * 2, Xr = Math.sin, Ai = Math.cos, ww = Math.acos, At = Math.atan2, mc = Math.abs, Un = Math.sqrt, On = Math.max, Fe = Math.min, xe = 1e-4;
function xw(r, t, e, i, n, a, o, s) {
  var l = e - r, u = i - t, f = o - n, h = s - a, c = h * l - f * u;
  if (!(c * c < xe))
    return c = (f * (t - a) - h * (r - n)) / c, [r + c * l, t + c * u];
}
function Ka(r, t, e, i, n, a, o) {
  var s = r - e, l = t - i, u = (o ? a : -a) / Un(s * s + l * l), f = u * l, h = -u * s, c = r + f, v = t + h, p = e + f, g = i + h, d = (c + p) / 2, y = (v + g) / 2, m = p - c, _ = g - v, S = m * m + _ * _, w = n - a, b = c * g - p * v, x = (_ < 0 ? -1 : 1) * Un(On(0, w * w * S - b * b)), M = (b * _ - m * x) / S, D = (-b * m - _ * x) / S, A = (b * _ + m * x) / S, C = (-b * m + _ * x) / S, I = M - d, L = D - y, P = A - d, R = C - y;
  return I * I + L * L > P * P + R * R && (M = A, D = C), {
    cx: M,
    cy: D,
    x0: -f,
    y0: -h,
    x1: M * (n / w - 1),
    y1: D * (n / w - 1)
  };
}
function Tw(r) {
  var t;
  if (O(r)) {
    var e = r.length;
    if (!e)
      return r;
    e === 1 ? t = [r[0], r[0], 0, 0] : e === 2 ? t = [r[0], r[0], r[1], r[1]] : e === 3 ? t = r.concat(r[2]) : t = r;
  } else
    t = [r, r, r, r];
  return t;
}
function Cw(r, t) {
  var e, i = On(t.r, 0), n = On(t.r0 || 0, 0), a = i > 0, o = n > 0;
  if (!(!a && !o)) {
    if (a || (i = n, n = 0), n > i) {
      var s = i;
      i = n, n = s;
    }
    var l = t.startAngle, u = t.endAngle;
    if (!(isNaN(l) || isNaN(u))) {
      var f = t.cx, h = t.cy, c = !!t.clockwise, v = mc(u - l), p = v > Bl && v % Bl;
      if (p > xe && (v = p), !(i > xe))
        r.moveTo(f, h);
      else if (v > Bl - xe)
        r.moveTo(f + i * Ai(l), h + i * Xr(l)), r.arc(f, h, i, l, u, !c), n > xe && (r.moveTo(f + n * Ai(u), h + n * Xr(u)), r.arc(f, h, n, u, l, c));
      else {
        var g = void 0, d = void 0, y = void 0, m = void 0, _ = void 0, S = void 0, w = void 0, b = void 0, x = void 0, M = void 0, D = void 0, A = void 0, C = void 0, I = void 0, L = void 0, P = void 0, R = i * Ai(l), E = i * Xr(l), G = n * Ai(u), N = n * Xr(u), B = v > xe;
        if (B) {
          var W = t.cornerRadius;
          W && (e = Tw(W), g = e[0], d = e[1], y = e[2], m = e[3]);
          var K = mc(i - n) / 2;
          if (_ = Fe(K, y), S = Fe(K, m), w = Fe(K, g), b = Fe(K, d), D = x = On(_, S), A = M = On(w, b), (x > xe || M > xe) && (C = i * Ai(u), I = i * Xr(u), L = n * Ai(l), P = n * Xr(l), v < Ly)) {
            var tt = xw(R, E, L, P, C, I, G, N);
            if (tt) {
              var lt = R - tt[0], yt = E - tt[1], _t = C - tt[0], Se = I - tt[1], Pr = 1 / Xr(ww((lt * _t + yt * Se) / (Un(lt * lt + yt * yt) * Un(_t * _t + Se * Se))) / 2), Si = Un(tt[0] * tt[0] + tt[1] * tt[1]);
              D = Fe(x, (i - Si) / (Pr + 1)), A = Fe(M, (n - Si) / (Pr - 1));
            }
          }
        }
        if (!B)
          r.moveTo(f + R, h + E);
        else if (D > xe) {
          var Jt = Fe(y, D), Tt = Fe(m, D), $ = Ka(L, P, R, E, i, Jt, c), et = Ka(C, I, G, N, i, Tt, c);
          r.moveTo(f + $.cx + $.x0, h + $.cy + $.y0), D < x && Jt === Tt ? r.arc(f + $.cx, h + $.cy, D, At($.y0, $.x0), At(et.y0, et.x0), !c) : (Jt > 0 && r.arc(f + $.cx, h + $.cy, Jt, At($.y0, $.x0), At($.y1, $.x1), !c), r.arc(f, h, i, At($.cy + $.y1, $.cx + $.x1), At(et.cy + et.y1, et.cx + et.x1), !c), Tt > 0 && r.arc(f + et.cx, h + et.cy, Tt, At(et.y1, et.x1), At(et.y0, et.x0), !c));
        } else
          r.moveTo(f + R, h + E), r.arc(f, h, i, l, u, !c);
        if (!(n > xe) || !B)
          r.lineTo(f + G, h + N);
        else if (A > xe) {
          var Jt = Fe(g, A), Tt = Fe(d, A), $ = Ka(G, N, C, I, n, -Tt, c), et = Ka(R, E, L, P, n, -Jt, c);
          r.lineTo(f + $.cx + $.x0, h + $.cy + $.y0), A < M && Jt === Tt ? r.arc(f + $.cx, h + $.cy, A, At($.y0, $.x0), At(et.y0, et.x0), !c) : (Tt > 0 && r.arc(f + $.cx, h + $.cy, Tt, At($.y0, $.x0), At($.y1, $.x1), !c), r.arc(f, h, n, At($.cy + $.y1, $.cx + $.x1), At(et.cy + et.y1, et.cx + et.x1), c), Jt > 0 && r.arc(f + et.cx, h + et.cy, Jt, At(et.y1, et.x1), At(et.y0, et.x0), !c));
        } else
          r.lineTo(f + G, h + N), r.arc(f, h, n, u, l, c);
      }
      r.closePath();
    }
  }
}
var Mw = /* @__PURE__ */ (function() {
  function r() {
    this.cx = 0, this.cy = 0, this.r0 = 0, this.r = 0, this.startAngle = 0, this.endAngle = Math.PI * 2, this.clockwise = !0, this.cornerRadius = 0;
  }
  return r;
})(), mi = (function(r) {
  ut(t, r);
  function t(e) {
    return r.call(this, e) || this;
  }
  return t.prototype.getDefaultShape = function() {
    return new Mw();
  }, t.prototype.buildPath = function(e, i) {
    Cw(e, i);
  }, t.prototype.isZeroArea = function() {
    return this.shape.startAngle === this.shape.endAngle || this.shape.r === this.shape.r0;
  }, t;
})(ot);
mi.prototype.type = "sector";
var Dw = /* @__PURE__ */ (function() {
  function r() {
    this.cx = 0, this.cy = 0, this.r = 0, this.r0 = 0;
  }
  return r;
})(), Rs = (function(r) {
  ut(t, r);
  function t(e) {
    return r.call(this, e) || this;
  }
  return t.prototype.getDefaultShape = function() {
    return new Dw();
  }, t.prototype.buildPath = function(e, i) {
    var n = i.cx, a = i.cy, o = Math.PI * 2;
    e.moveTo(n + i.r, a), e.arc(n, a, i.r, 0, o, !1), e.moveTo(n + i.r0, a), e.arc(n, a, i.r0, 0, o, !0);
  }, t;
})(ot);
Rs.prototype.type = "ring";
function Aw(r, t, e, i) {
  var n = [], a = [], o = [], s = [], l, u, f, h;
  if (i) {
    f = [1 / 0, 1 / 0], h = [-1 / 0, -1 / 0];
    for (var c = 0, v = r.length; c < v; c++)
      dr(f, f, r[c]), gr(h, h, r[c]);
    dr(f, f, i[0]), gr(h, h, i[1]);
  }
  for (var c = 0, v = r.length; c < v; c++) {
    var p = r[c];
    if (e)
      l = r[c ? c - 1 : v - 1], u = r[(c + 1) % v];
    else if (c === 0 || c === v - 1) {
      n.push(Ag(r[c]));
      continue;
    } else
      l = r[c - 1], u = r[c + 1];
    Jf(a, u, l), Do(a, a, t);
    var g = Uo(p, l), d = Uo(p, u), y = g + d;
    y !== 0 && (g /= y, d /= y), Do(o, a, -g), Do(s, a, d);
    var m = Ou([], p, o), _ = Ou([], p, s);
    i && (gr(m, m, f), dr(m, m, h), gr(_, _, f), dr(_, _, h)), n.push(m), n.push(_);
  }
  return e && n.push(n.shift()), n;
}
function Py(r, t, e) {
  var i = t.smooth, n = t.points;
  if (n && n.length >= 2) {
    if (i) {
      var a = Aw(n, i, e, t.smoothConstraint);
      r.moveTo(n[0][0], n[0][1]);
      for (var o = n.length, s = 0; s < (e ? o : o - 1); s++) {
        var l = a[s * 2], u = a[s * 2 + 1], f = n[(s + 1) % o];
        r.bezierCurveTo(l[0], l[1], u[0], u[1], f[0], f[1]);
      }
    } else {
      r.moveTo(n[0][0], n[0][1]);
      for (var s = 1, h = n.length; s < h; s++)
        r.lineTo(n[s][0], n[s][1]);
    }
    e && r.closePath();
  }
}
var Iw = /* @__PURE__ */ (function() {
  function r() {
    this.points = null, this.smooth = 0, this.smoothConstraint = null;
  }
  return r;
})(), Aa = (function(r) {
  ut(t, r);
  function t(e) {
    return r.call(this, e) || this;
  }
  return t.prototype.getDefaultShape = function() {
    return new Iw();
  }, t.prototype.buildPath = function(e, i) {
    Py(e, i, !0);
  }, t;
})(ot);
Aa.prototype.type = "polygon";
var Lw = /* @__PURE__ */ (function() {
  function r() {
    this.points = null, this.percent = 1, this.smooth = 0, this.smoothConstraint = null;
  }
  return r;
})(), Es = (function(r) {
  ut(t, r);
  function t(e) {
    return r.call(this, e) || this;
  }
  return t.prototype.getDefaultStyle = function() {
    return {
      stroke: "#000",
      fill: null
    };
  }, t.prototype.getDefaultShape = function() {
    return new Lw();
  }, t.prototype.buildPath = function(e, i) {
    Py(e, i, !1);
  }, t;
})(ot);
Es.prototype.type = "polyline";
var Pw = {}, Rw = /* @__PURE__ */ (function() {
  function r() {
    this.x1 = 0, this.y1 = 0, this.x2 = 0, this.y2 = 0, this.percent = 1;
  }
  return r;
})(), Xe = (function(r) {
  ut(t, r);
  function t(e) {
    return r.call(this, e) || this;
  }
  return t.prototype.getDefaultStyle = function() {
    return {
      stroke: "#000",
      fill: null
    };
  }, t.prototype.getDefaultShape = function() {
    return new Rw();
  }, t.prototype.buildPath = function(e, i) {
    var n, a, o, s;
    if (this.subPixelOptimize) {
      var l = gy(Pw, i, this.style);
      n = l.x1, a = l.y1, o = l.x2, s = l.y2;
    } else
      n = i.x1, a = i.y1, o = i.x2, s = i.y2;
    var u = i.percent;
    u !== 0 && (e.moveTo(n, a), u < 1 && (o = n * (1 - u) + o * u, s = a * (1 - u) + s * u), e.lineTo(o, s));
  }, t.prototype.pointAt = function(e) {
    var i = this.shape;
    return [
      i.x1 * (1 - e) + i.x2 * e,
      i.y1 * (1 - e) + i.y2 * e
    ];
  }, t;
})(ot);
Xe.prototype.type = "line";
var Yt = [], Ew = /* @__PURE__ */ (function() {
  function r() {
    this.x1 = 0, this.y1 = 0, this.x2 = 0, this.y2 = 0, this.cpx1 = 0, this.cpy1 = 0, this.percent = 1;
  }
  return r;
})();
function _c(r, t, e) {
  var i = r.cpx2, n = r.cpy2;
  return i != null || n != null ? [
    (e ? Tv : Ct)(r.x1, r.cpx1, r.cpx2, r.x2, t),
    (e ? Tv : Ct)(r.y1, r.cpy1, r.cpy2, r.y2, t)
  ] : [
    (e ? Cv : $t)(r.x1, r.cpx1, r.x2, t),
    (e ? Cv : $t)(r.y1, r.cpy1, r.y2, t)
  ];
}
var Ia = (function(r) {
  ut(t, r);
  function t(e) {
    return r.call(this, e) || this;
  }
  return t.prototype.getDefaultStyle = function() {
    return {
      stroke: "#000",
      fill: null
    };
  }, t.prototype.getDefaultShape = function() {
    return new Ew();
  }, t.prototype.buildPath = function(e, i) {
    var n = i.x1, a = i.y1, o = i.x2, s = i.y2, l = i.cpx1, u = i.cpy1, f = i.cpx2, h = i.cpy2, c = i.percent;
    c !== 0 && (e.moveTo(n, a), f == null || h == null ? (c < 1 && (Ko(n, l, o, c, Yt), l = Yt[1], o = Yt[2], Ko(a, u, s, c, Yt), u = Yt[1], s = Yt[2]), e.quadraticCurveTo(l, u, o, s)) : (c < 1 && (qo(n, l, f, o, c, Yt), l = Yt[1], f = Yt[2], o = Yt[3], qo(a, u, h, s, c, Yt), u = Yt[1], h = Yt[2], s = Yt[3]), e.bezierCurveTo(l, u, f, h, o, s)));
  }, t.prototype.pointAt = function(e) {
    return _c(this.shape, e, !1);
  }, t.prototype.tangentAt = function(e) {
    var i = _c(this.shape, e, !0);
    return bs(i, i);
  }, t;
})(ot);
Ia.prototype.type = "bezier-curve";
var Ow = /* @__PURE__ */ (function() {
  function r() {
    this.cx = 0, this.cy = 0, this.r = 0, this.startAngle = 0, this.endAngle = Math.PI * 2, this.clockwise = !0;
  }
  return r;
})(), La = (function(r) {
  ut(t, r);
  function t(e) {
    return r.call(this, e) || this;
  }
  return t.prototype.getDefaultStyle = function() {
    return {
      stroke: "#000",
      fill: null
    };
  }, t.prototype.getDefaultShape = function() {
    return new Ow();
  }, t.prototype.buildPath = function(e, i) {
    var n = i.cx, a = i.cy, o = Math.max(i.r, 0), s = i.startAngle, l = i.endAngle, u = i.clockwise, f = Math.cos(s), h = Math.sin(s);
    e.moveTo(f * o + n, h * o + a), e.arc(n, a, o, s, l, !u);
  }, t;
})(ot);
La.prototype.type = "arc";
var Ry = (function(r) {
  ut(t, r);
  function t() {
    var e = r !== null && r.apply(this, arguments) || this;
    return e.type = "compound", e;
  }
  return t.prototype._updatePathDirty = function() {
    for (var e = this.shape.paths, i = this.shapeChanged(), n = 0; n < e.length; n++)
      i = i || e[n].shapeChanged();
    i && this.dirtyShape();
  }, t.prototype.beforeBrush = function() {
    this._updatePathDirty();
    for (var e = this.shape.paths || [], i = this.getGlobalScale(), n = 0; n < e.length; n++)
      e[n].path || e[n].createPathProxy(), e[n].path.setScale(i[0], i[1], e[n].segmentIgnoreThreshold);
  }, t.prototype.buildPath = function(e, i) {
    for (var n = i.paths || [], a = 0; a < n.length; a++)
      n[a].buildPath(e, n[a].shape, !0);
  }, t.prototype.afterBrush = function() {
    for (var e = this.shape.paths || [], i = 0; i < e.length; i++)
      e[i].pathUpdated();
  }, t.prototype.getBoundingRect = function() {
    return this._updatePathDirty.call(this), ot.prototype.getBoundingRect.call(this);
  }, t;
})(ot), Ey = (function() {
  function r(t) {
    this.colorStops = t || [];
  }
  return r.prototype.addColorStop = function(t, e) {
    this.colorStops.push({
      offset: t,
      color: e
    });
  }, r;
})(), Os = (function(r) {
  ut(t, r);
  function t(e, i, n, a, o, s) {
    var l = r.call(this, o) || this;
    return l.x = e ?? 0, l.y = i ?? 0, l.x2 = n ?? 1, l.y2 = a ?? 0, l.type = "linear", l.global = s || !1, l;
  }
  return t;
})(Ey), Oy = (function(r) {
  ut(t, r);
  function t(e, i, n, a, o) {
    var s = r.call(this, a) || this;
    return s.x = e ?? 0.5, s.y = i ?? 0.5, s.r = n ?? 0.5, s.type = "radial", s.global = o || !1, s;
  }
  return t;
})(Ey), $r = [0, 0], Zr = [0, 0], Qa = new ft(), Ja = new ft(), es = (function() {
  function r(t, e) {
    this._corners = [], this._axes = [], this._origin = [0, 0];
    for (var i = 0; i < 4; i++)
      this._corners[i] = new ft();
    for (var i = 0; i < 2; i++)
      this._axes[i] = new ft();
    t && this.fromBoundingRect(t, e);
  }
  return r.prototype.fromBoundingRect = function(t, e) {
    var i = this._corners, n = this._axes, a = t.x, o = t.y, s = a + t.width, l = o + t.height;
    if (i[0].set(a, o), i[1].set(s, o), i[2].set(s, l), i[3].set(a, l), e)
      for (var u = 0; u < 4; u++)
        i[u].transform(e);
    ft.sub(n[0], i[1], i[0]), ft.sub(n[1], i[3], i[0]), n[0].normalize(), n[1].normalize();
    for (var u = 0; u < 2; u++)
      this._origin[u] = n[u].dot(i[0]);
  }, r.prototype.intersect = function(t, e) {
    var i = !0, n = !e;
    return Qa.set(1 / 0, 1 / 0), Ja.set(0, 0), !this._intersectCheckOneSide(this, t, Qa, Ja, n, 1) && (i = !1, n) || !this._intersectCheckOneSide(t, this, Qa, Ja, n, -1) && (i = !1, n) || n || ft.copy(e, i ? Qa : Ja), i;
  }, r.prototype._intersectCheckOneSide = function(t, e, i, n, a, o) {
    for (var s = !0, l = 0; l < 2; l++) {
      var u = this._axes[l];
      if (this._getProjMinMaxOnAxis(l, t._corners, $r), this._getProjMinMaxOnAxis(l, e._corners, Zr), $r[1] < Zr[0] || $r[0] > Zr[1]) {
        if (s = !1, a)
          return s;
        var f = Math.abs(Zr[0] - $r[1]), h = Math.abs($r[0] - Zr[1]);
        Math.min(f, h) > n.len() && (f < h ? ft.scale(n, u, -f * o) : ft.scale(n, u, h * o));
      } else if (i) {
        var f = Math.abs(Zr[0] - $r[1]), h = Math.abs($r[0] - Zr[1]);
        Math.min(f, h) < i.len() && (f < h ? ft.scale(i, u, f * o) : ft.scale(i, u, -h * o));
      }
    }
    return s;
  }, r.prototype._getProjMinMaxOnAxis = function(t, e, i) {
    for (var n = this._axes[t], a = this._origin, o = e[0].dot(n) + a[t], s = o, l = o, u = 1; u < e.length; u++) {
      var f = e[u].dot(n) + a[t];
      s = Math.min(f, s), l = Math.max(f, l);
    }
    i[0] = s, i[1] = l;
  }, r;
})(), kw = [], ky = (function(r) {
  ut(t, r);
  function t() {
    var e = r !== null && r.apply(this, arguments) || this;
    return e.notClear = !0, e.incremental = !0, e._displayables = [], e._temporaryDisplayables = [], e._cursor = 0, e;
  }
  return t.prototype.traverse = function(e, i) {
    e.call(i, this);
  }, t.prototype.useStyle = function() {
    this.style = {};
  }, t.prototype.getCursor = function() {
    return this._cursor;
  }, t.prototype.innerAfterBrush = function() {
    this._cursor = this._displayables.length;
  }, t.prototype.clearDisplaybles = function() {
    this._displayables = [], this._temporaryDisplayables = [], this._cursor = 0, this.markRedraw(), this.notClear = !1;
  }, t.prototype.clearTemporalDisplayables = function() {
    this._temporaryDisplayables = [];
  }, t.prototype.addDisplayable = function(e, i) {
    i ? this._temporaryDisplayables.push(e) : this._displayables.push(e), this.markRedraw();
  }, t.prototype.addDisplayables = function(e, i) {
    i = i || !1;
    for (var n = 0; n < e.length; n++)
      this.addDisplayable(e[n], i);
  }, t.prototype.getDisplayables = function() {
    return this._displayables;
  }, t.prototype.getTemporalDisplayables = function() {
    return this._temporaryDisplayables;
  }, t.prototype.eachPendingDisplayable = function(e) {
    for (var i = this._cursor; i < this._displayables.length; i++)
      e && e(this._displayables[i]);
    for (var i = 0; i < this._temporaryDisplayables.length; i++)
      e && e(this._temporaryDisplayables[i]);
  }, t.prototype.update = function() {
    this.updateTransform();
    for (var e = this._cursor; e < this._displayables.length; e++) {
      var i = this._displayables[e];
      i.parent = this, i.update(), i.parent = null;
    }
    for (var e = 0; e < this._temporaryDisplayables.length; e++) {
      var i = this._temporaryDisplayables[e];
      i.parent = this, i.update(), i.parent = null;
    }
  }, t.prototype.getBoundingRect = function() {
    if (!this._rect) {
      for (var e = new it(1 / 0, 1 / 0, -1 / 0, -1 / 0), i = 0; i < this._displayables.length; i++) {
        var n = this._displayables[i], a = n.getBoundingRect().clone();
        n.needLocalTransform() && a.applyTransform(n.getLocalTransform(kw)), e.union(a);
      }
      this._rect = e;
    }
    return this._rect;
  }, t.prototype.contain = function(e, i) {
    var n = this.transformCoordToLocal(e, i), a = this.getBoundingRect();
    if (a.contain(n[0], n[1]))
      for (var o = 0; o < this._displayables.length; o++) {
        var s = this._displayables[o];
        if (s.contain(e, i))
          return !0;
      }
    return !1;
  }, t;
})(Ma), Nw = bt();
function Bw(r, t, e, i, n) {
  var a;
  if (t && t.ecModel) {
    var o = t.ecModel.getUpdatePayload();
    a = o && o.animation;
  }
  var s = t && t.isAnimationEnabled(), l = r === "update";
  if (s) {
    var u = void 0, f = void 0, h = void 0;
    i ? (u = Z(i.duration, 200), f = Z(i.easing, "cubicOut"), h = 0) : (u = t.getShallow(l ? "animationDurationUpdate" : "animationDuration"), f = t.getShallow(l ? "animationEasingUpdate" : "animationEasing"), h = t.getShallow(l ? "animationDelayUpdate" : "animationDelay")), a && (a.duration != null && (u = a.duration), a.easing != null && (f = a.easing), a.delay != null && (h = a.delay)), X(h) && (h = h(e, n)), X(u) && (u = u(e));
    var c = {
      duration: u || 0,
      delay: h,
      easing: f
    };
    return c;
  } else
    return null;
}
function Sh(r, t, e, i, n, a, o) {
  var s = !1, l;
  X(n) ? (o = a, a = n, n = null) : H(n) && (a = n.cb, o = n.during, s = n.isFrom, l = n.removeOpt, n = n.dataIndex);
  var u = r === "leave";
  u || t.stopAnimation("leave");
  var f = Bw(r, i, n, u ? l || {} : null, i && i.getAnimationDelayParams ? i.getAnimationDelayParams(t, n) : null);
  if (f && f.duration > 0) {
    var h = f.duration, c = f.delay, v = f.easing, p = {
      duration: h,
      delay: c || 0,
      easing: v,
      done: a,
      force: !!a || !!o,
      // Set to final state in update/init animation.
      // So the post processing based on the path shape can be done correctly.
      setToFinal: !u,
      scope: r,
      during: o
    };
    s ? t.animateFrom(e, p) : t.animateTo(e, p);
  } else
    t.stopAnimation(), !s && t.attr(e), o && o(1), a && a();
}
function Wt(r, t, e, i, n, a) {
  Sh("update", r, t, e, i, n, a);
}
function Oe(r, t, e, i, n, a) {
  Sh("enter", r, t, e, i, n, a);
}
function Yn(r) {
  if (!r.__zr)
    return !0;
  for (var t = 0; t < r.animators.length; t++) {
    var e = r.animators[t];
    if (e.scope === "leave")
      return !0;
  }
  return !1;
}
function rs(r, t, e, i, n, a) {
  Yn(r) || Sh("leave", r, t, e, i, n, a);
}
function Sc(r, t, e, i) {
  r.removeTextContent(), r.removeTextGuideLine(), rs(r, {
    style: {
      opacity: 0
    }
  }, t, e, i);
}
function ff(r, t, e) {
  function i() {
    r.parent && r.parent.remove(r);
  }
  r.isGroup ? r.traverse(function(n) {
    n.isGroup || Sc(n, t, e, i);
  }) : Sc(r, t, e, i);
}
function Ny(r) {
  Nw(r).oldStyle = r.style;
}
var is = Math.max, ns = Math.min, hf = {};
function By(r) {
  return ot.extend(r);
}
var zw = mw;
function zy(r, t) {
  return zw(r, t);
}
function me(r, t) {
  hf[r] = t;
}
function Fy(r) {
  if (hf.hasOwnProperty(r))
    return hf[r];
}
function ks(r, t, e, i) {
  var n = yw(r, t);
  return e && (i === "center" && (e = Vy(e, n.getBoundingRect())), wh(n, e)), n;
}
function bh(r, t, e) {
  var i = new ke({
    style: {
      image: r,
      x: t.x,
      y: t.y,
      width: t.width,
      height: t.height
    },
    onload: function(n) {
      if (e === "center") {
        var a = {
          width: n.width,
          height: n.height
        };
        i.setStyle(Vy(t, a));
      }
    }
  });
  return i;
}
function Vy(r, t) {
  var e = t.width / t.height, i = r.height * e, n;
  i <= r.width ? n = r.height : (i = r.width, n = i / e);
  var a = r.x + r.width / 2, o = r.y + r.height / 2;
  return {
    x: a - i / 2,
    y: o - n / 2,
    width: i,
    height: n
  };
}
var Hy = _w;
function wh(r, t) {
  if (r.applyTransform) {
    var e = r.getBoundingRect(), i = e.calculateTransform(t);
    r.applyTransform(i);
  }
}
function ua(r, t) {
  return gy(r, r, {
    lineWidth: t
  }), r;
}
function Fw(r) {
  return yy(r.shape, r.shape, r.style), r;
}
var Vw = ii;
function Xn(r, t) {
  for (var e = ba([]); r && r !== t; )
    br(e, r.getLocalTransform(), e), r = r.parent;
  return e;
}
function Yi(r, t, e) {
  return t && !Ht(t) && (t = ah.getLocalTransform(t)), e && (t = wa([], t)), Vt([], r, t);
}
function Gy(r, t, e) {
  var i = t[4] === 0 || t[5] === 0 || t[0] === 0 ? 1 : Math.abs(2 * t[4] / t[0]), n = t[4] === 0 || t[5] === 0 || t[2] === 0 ? 1 : Math.abs(2 * t[4] / t[2]), a = [r === "left" ? -i : r === "right" ? i : 0, r === "top" ? -n : r === "bottom" ? n : 0];
  return a = Yi(a, t, e), Math.abs(a[0]) > Math.abs(a[1]) ? a[0] > 0 ? "right" : "left" : a[1] > 0 ? "bottom" : "top";
}
function bc(r) {
  return !r.isGroup;
}
function Hw(r) {
  return r.shape != null;
}
function Wy(r, t, e) {
  if (!r || !t)
    return;
  function i(o) {
    var s = {};
    return o.traverse(function(l) {
      bc(l) && l.anid && (s[l.anid] = l);
    }), s;
  }
  function n(o) {
    var s = {
      x: o.x,
      y: o.y,
      rotation: o.rotation
    };
    return Hw(o) && (s.shape = k({}, o.shape)), s;
  }
  var a = i(r);
  t.traverse(function(o) {
    if (bc(o) && o.anid) {
      var s = a[o.anid];
      if (s) {
        var l = n(o);
        o.attr(n(s)), Wt(o, l, e, J(o).dataIndex);
      }
    }
  });
}
function Uy(r, t) {
  return z(r, function(e) {
    var i = e[0];
    i = is(i, t.x), i = ns(i, t.x + t.width);
    var n = e[1];
    return n = is(n, t.y), n = ns(n, t.y + t.height), [i, n];
  });
}
function Yy(r, t) {
  var e = is(r.x, t.x), i = ns(r.x + r.width, t.x + t.width), n = is(r.y, t.y), a = ns(r.y + r.height, t.y + t.height);
  if (i >= e && a >= n)
    return {
      x: e,
      y: n,
      width: i - e,
      height: a - n
    };
}
function Ns(r, t, e) {
  var i = k({
    rectHover: !0
  }, t), n = i.style = {
    strokeNoScale: !0
  };
  if (e = e || {
    x: -1,
    y: -1,
    width: 2,
    height: 2
  }, r)
    return r.indexOf("image://") === 0 ? (n.image = r.slice(8), at(n, e), new ke(i)) : ks(r.replace("path://", ""), i, e, "center");
}
function Gw(r, t, e, i, n) {
  for (var a = 0, o = n[n.length - 1]; a < n.length; a++) {
    var s = n[a];
    if (Xy(r, t, e, i, s[0], s[1], o[0], o[1]))
      return !0;
    o = s;
  }
}
function Xy(r, t, e, i, n, a, o, s) {
  var l = e - r, u = i - t, f = o - n, h = s - a, c = zl(f, h, l, u);
  if (Ww(c))
    return !1;
  var v = r - n, p = t - a, g = zl(v, p, l, u) / c;
  if (g < 0 || g > 1)
    return !1;
  var d = zl(v, p, f, h) / c;
  return !(d < 0 || d > 1);
}
function zl(r, t, e, i) {
  return r * i - e * t;
}
function Ww(r) {
  return r <= 1e-6 && r >= -1e-6;
}
function Bs(r) {
  var t = r.itemTooltipOption, e = r.componentModel, i = r.itemName, n = V(t) ? {
    formatter: t
  } : t, a = e.mainType, o = e.componentIndex, s = {
    componentType: a,
    name: i,
    $vars: ["name"]
  };
  s[a + "Index"] = o;
  var l = r.formatterParamsExtra;
  l && T(ct(l), function(f) {
    Mr(s, f) || (s[f] = l[f], s.$vars.push(f));
  });
  var u = J(r.el);
  u.componentMainType = a, u.componentIndex = o, u.tooltipConfig = {
    name: i,
    option: at({
      content: i,
      encodeHTMLContent: !0,
      formatterParams: s
    }, n)
  };
}
function wc(r, t) {
  var e;
  r.isGroup && (e = t(r)), e || r.traverse(t);
}
function rn(r, t) {
  if (r)
    if (O(r))
      for (var e = 0; e < r.length; e++)
        wc(r[e], t);
    else
      wc(r, t);
}
me("circle", Da);
me("ellipse", Ps);
me("sector", mi);
me("ring", Rs);
me("polygon", Aa);
me("polyline", Es);
me("rect", dt);
me("line", Xe);
me("bezierCurve", Ia);
me("arc", La);
const Uw = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Arc: La,
  BezierCurve: Ia,
  BoundingRect: it,
  Circle: Da,
  CompoundPath: Ry,
  Ellipse: Ps,
  Group: gt,
  Image: ke,
  IncrementalDisplayable: ky,
  Line: Xe,
  LinearGradient: Os,
  OrientedBoundingRect: es,
  Path: ot,
  Point: ft,
  Polygon: Aa,
  Polyline: Es,
  RadialGradient: Oy,
  Rect: dt,
  Ring: Rs,
  Sector: mi,
  Text: mt,
  applyTransform: Yi,
  clipPointsByRect: Uy,
  clipRectByRect: Yy,
  createIcon: Ns,
  extendPath: zy,
  extendShape: By,
  getShapeClass: Fy,
  getTransform: Xn,
  groupTransition: Wy,
  initProps: Oe,
  isElementRemoved: Yn,
  lineLineIntersect: Xy,
  linePolygonIntersect: Gw,
  makeImage: bh,
  makePath: ks,
  mergePath: Hy,
  registerShape: me,
  removeElement: rs,
  removeElementWithFadeOut: ff,
  resizePath: wh,
  setTooltipConfig: Bs,
  subPixelOptimize: Vw,
  subPixelOptimizeLine: ua,
  subPixelOptimizeRect: Fw,
  transformDirection: Gy,
  traverseElements: rn,
  updateProps: Wt
}, Symbol.toStringTag, { value: "Module" }));
var zs = {};
function Yw(r, t) {
  for (var e = 0; e < de.length; e++) {
    var i = de[e], n = t[i], a = r.ensureState(i);
    a.style = a.style || {}, a.style.text = n;
  }
  var o = r.currentStates.slice();
  r.clearStates(!0), r.setStyle({
    text: t.normal
  }), r.useStates(o, !0);
}
function xc(r, t, e) {
  var i = r.labelFetcher, n = r.labelDataIndex, a = r.labelDimIndex, o = t.normal, s;
  i && (s = i.getFormattedLabel(n, "normal", null, a, o && o.get("formatter"), e != null ? {
    interpolatedValue: e
  } : null)), s == null && (s = X(r.defaultText) ? r.defaultText(n, r, e) : r.defaultText);
  for (var l = {
    normal: s
  }, u = 0; u < de.length; u++) {
    var f = de[u], h = t[f];
    l[f] = Z(i ? i.getFormattedLabel(n, f, null, a, h && h.get("formatter")) : null, s);
  }
  return l;
}
function nn(r, t, e, i) {
  e = e || zs;
  for (var n = r instanceof mt, a = !1, o = 0; o < oc.length; o++) {
    var s = t[oc[o]];
    if (s && s.getShallow("show")) {
      a = !0;
      break;
    }
  }
  var l = n ? r : r.getTextContent();
  if (a) {
    n || (l || (l = new mt(), r.setTextContent(l)), r.stateProxy && (l.stateProxy = r.stateProxy));
    var u = xc(e, t), f = t.normal, h = !!f.getShallow("show"), c = re(f, i && i.normal, e, !1, !n);
    c.text = u.normal, n || r.setTextConfig(Tc(f, e, !1));
    for (var o = 0; o < de.length; o++) {
      var v = de[o], s = t[v];
      if (s) {
        var p = l.ensureState(v), g = !!Z(s.getShallow("show"), h);
        if (g !== h && (p.ignore = !g), p.style = re(s, i && i[v], e, !0, !n), p.style.text = u[v], !n) {
          var d = r.ensureState(v);
          d.textConfig = Tc(s, e, !0);
        }
      }
    }
    l.silent = !!f.getShallow("silent"), l.style.x != null && (c.x = l.style.x), l.style.y != null && (c.y = l.style.y), l.ignore = !h, l.useStyle(c), l.dirty(), e.enableTextSetter && (Fs(l).setLabelText = function(y) {
      var m = xc(e, t, y);
      Yw(l, m);
    });
  } else l && (l.ignore = !0);
  r.dirty();
}
function Dr(r, t) {
  t = t || "label";
  for (var e = {
    normal: r.getModel(t)
  }, i = 0; i < de.length; i++) {
    var n = de[i];
    e[n] = r.getModel([n, t]);
  }
  return e;
}
function re(r, t, e, i, n) {
  var a = {};
  return Xw(a, r, e, i, n), t && k(a, t), a;
}
function Tc(r, t, e) {
  t = t || {};
  var i = {}, n, a = r.getShallow("rotate"), o = Z(r.getShallow("distance"), e ? null : 5), s = r.getShallow("offset");
  return n = r.getShallow("position") || (e ? null : "inside"), n === "outside" && (n = t.defaultOutsidePosition || "top"), n != null && (i.position = n), s != null && (i.offset = s), a != null && (a *= Math.PI / 180, i.rotation = a), o != null && (i.distance = o), i.outsideFill = r.get("color") === "inherit" ? t.inheritColor || null : "auto", i;
}
function Xw(r, t, e, i, n) {
  e = e || zs;
  var a = t.ecModel, o = a && a.option.textStyle, s = $w(t), l;
  if (s) {
    l = {};
    for (var u in s)
      if (s.hasOwnProperty(u)) {
        var f = t.getModel(["rich", u]);
        Ac(l[u] = {}, f, o, e, i, n, !1, !0);
      }
  }
  l && (r.rich = l);
  var h = t.get("overflow");
  h && (r.overflow = h);
  var c = t.get("minMargin");
  c != null && (r.margin = c), Ac(r, t, o, e, i, n, !0, !1);
}
function $w(r) {
  for (var t; r && r !== r.ecModel; ) {
    var e = (r.option || zs).rich;
    if (e) {
      t = t || {};
      for (var i = ct(e), n = 0; n < i.length; n++) {
        var a = i[n];
        t[a] = 1;
      }
    }
    r = r.parentModel;
  }
  return t;
}
var Cc = ["fontStyle", "fontWeight", "fontSize", "fontFamily", "textShadowColor", "textShadowBlur", "textShadowOffsetX", "textShadowOffsetY"], Mc = ["align", "lineHeight", "width", "height", "tag", "verticalAlign", "ellipsis"], Dc = ["padding", "borderWidth", "borderRadius", "borderDashOffset", "backgroundColor", "borderColor", "shadowColor", "shadowBlur", "shadowOffsetX", "shadowOffsetY"];
function Ac(r, t, e, i, n, a, o, s) {
  e = !n && e || zs;
  var l = i && i.inheritColor, u = t.getShallow("color"), f = t.getShallow("textBorderColor"), h = Z(t.getShallow("opacity"), e.opacity);
  (u === "inherit" || u === "auto") && (l ? u = l : u = null), (f === "inherit" || f === "auto") && (l ? f = l : f = null), a || (u = u || e.color, f = f || e.textBorderColor), u != null && (r.fill = u), f != null && (r.stroke = f);
  var c = Z(t.getShallow("textBorderWidth"), e.textBorderWidth);
  c != null && (r.lineWidth = c);
  var v = Z(t.getShallow("textBorderType"), e.textBorderType);
  v != null && (r.lineDash = v);
  var p = Z(t.getShallow("textBorderDashOffset"), e.textBorderDashOffset);
  p != null && (r.lineDashOffset = p), !n && h == null && !s && (h = i && i.defaultOpacity), h != null && (r.opacity = h), !n && !a && r.fill == null && i.inheritColor && (r.fill = i.inheritColor);
  for (var g = 0; g < Cc.length; g++) {
    var d = Cc[g], y = Z(t.getShallow(d), e[d]);
    y != null && (r[d] = y);
  }
  for (var g = 0; g < Mc.length; g++) {
    var d = Mc[g], y = t.getShallow(d);
    y != null && (r[d] = y);
  }
  if (r.verticalAlign == null) {
    var m = t.getShallow("baseline");
    m != null && (r.verticalAlign = m);
  }
  if (!o || !i.disableBox) {
    for (var g = 0; g < Dc.length; g++) {
      var d = Dc[g], y = t.getShallow(d);
      y != null && (r[d] = y);
    }
    var _ = t.getShallow("borderType");
    _ != null && (r.borderDash = _), (r.backgroundColor === "auto" || r.backgroundColor === "inherit") && l && (r.backgroundColor = l), (r.borderColor === "auto" || r.borderColor === "inherit") && l && (r.borderColor = l);
  }
}
function Zw(r, t) {
  var e = t && t.getModel("textStyle");
  return Me([
    // FIXME in node-canvas fontWeight is before fontStyle
    r.fontStyle || e && e.getShallow("fontStyle") || "",
    r.fontWeight || e && e.getShallow("fontWeight") || "",
    (r.fontSize || e && e.getShallow("fontSize") || 12) + "px",
    r.fontFamily || e && e.getShallow("fontFamily") || "sans-serif"
  ].join(" "));
}
var Fs = bt();
function qw(r, t, e, i) {
  if (r) {
    var n = Fs(r);
    n.prevValue = n.value, n.value = e;
    var a = t.normal;
    n.valueAnimation = a.get("valueAnimation"), n.valueAnimation && (n.precision = a.get("precision"), n.defaultInterpolatedText = i, n.statesModels = t);
  }
}
var Kw = ["textStyle", "color"], Fl = ["fontStyle", "fontWeight", "fontSize", "fontFamily", "padding", "lineHeight", "rich", "width", "height", "overflow"], Vl = new mt(), Qw = (
  /** @class */
  (function() {
    function r() {
    }
    return r.prototype.getTextColor = function(t) {
      var e = this.ecModel;
      return this.getShallow("color") || (!t && e ? e.get(Kw) : null);
    }, r.prototype.getFont = function() {
      return Zw({
        fontStyle: this.getShallow("fontStyle"),
        fontWeight: this.getShallow("fontWeight"),
        fontSize: this.getShallow("fontSize"),
        fontFamily: this.getShallow("fontFamily")
      }, this.ecModel);
    }, r.prototype.getTextRect = function(t) {
      for (var e = {
        text: t,
        verticalAlign: this.getShallow("verticalAlign") || this.getShallow("baseline")
      }, i = 0; i < Fl.length; i++)
        e[Fl[i]] = this.getShallow(Fl[i]);
      return Vl.useStyle(e), Vl.update(), Vl.getBoundingRect();
    }, r;
  })()
), $y = [
  ["lineWidth", "width"],
  ["stroke", "color"],
  ["opacity"],
  ["shadowBlur"],
  ["shadowOffsetX"],
  ["shadowOffsetY"],
  ["shadowColor"],
  ["lineDash", "type"],
  ["lineDashOffset", "dashOffset"],
  ["lineCap", "cap"],
  ["lineJoin", "join"],
  ["miterLimit"]
  // Option decal is in `DecalObject` but style.decal is in `PatternObject`.
  // So do not transfer decal directly.
], Jw = oa($y), jw = (
  /** @class */
  (function() {
    function r() {
    }
    return r.prototype.getLineStyle = function(t) {
      return Jw(this, t);
    }, r;
  })()
), Zy = [
  ["fill", "color"],
  ["stroke", "borderColor"],
  ["lineWidth", "borderWidth"],
  ["opacity"],
  ["shadowBlur"],
  ["shadowOffsetX"],
  ["shadowOffsetY"],
  ["shadowColor"],
  ["lineDash", "borderType"],
  ["lineDashOffset", "borderDashOffset"],
  ["lineCap", "borderCap"],
  ["lineJoin", "borderJoin"],
  ["miterLimit", "borderMiterLimit"]
  // Option decal is in `DecalObject` but style.decal is in `PatternObject`.
  // So do not transfer decal directly.
], tx = oa(Zy), ex = (
  /** @class */
  (function() {
    function r() {
    }
    return r.prototype.getItemStyle = function(t, e) {
      return tx(this, t, e);
    }, r;
  })()
), pt = (
  /** @class */
  (function() {
    function r(t, e, i) {
      this.parentModel = e, this.ecModel = i, this.option = t;
    }
    return r.prototype.init = function(t, e, i) {
    }, r.prototype.mergeOption = function(t, e) {
      j(this.option, t, !0);
    }, r.prototype.get = function(t, e) {
      return t == null ? this.option : this._doGet(this.parsePath(t), !e && this.parentModel);
    }, r.prototype.getShallow = function(t, e) {
      var i = this.option, n = i == null ? i : i[t];
      if (n == null && !e) {
        var a = this.parentModel;
        a && (n = a.getShallow(t));
      }
      return n;
    }, r.prototype.getModel = function(t, e) {
      var i = t != null, n = i ? this.parsePath(t) : null, a = i ? this._doGet(n) : this.option;
      return e = e || this.parentModel && this.parentModel.getModel(this.resolveParentPath(n)), new r(a, e, this.ecModel);
    }, r.prototype.isEmpty = function() {
      return this.option == null;
    }, r.prototype.restoreData = function() {
    }, r.prototype.clone = function() {
      var t = this.constructor;
      return new t(U(this.option));
    }, r.prototype.parsePath = function(t) {
      return typeof t == "string" ? t.split(".") : t;
    }, r.prototype.resolveParentPath = function(t) {
      return t;
    }, r.prototype.isAnimationEnabled = function() {
      if (!Y.node && this.option) {
        if (this.option.animation != null)
          return !!this.option.animation;
        if (this.parentModel)
          return this.parentModel.isAnimationEnabled();
      }
    }, r.prototype._doGet = function(t, e) {
      var i = this.option;
      if (!t)
        return i;
      for (var n = 0; n < t.length && !(t[n] && (i = i && typeof i == "object" ? i[t[n]] : null, i == null)); n++)
        ;
      return i == null && e && (i = e._doGet(this.resolveParentPath(t), e.parentModel)), i;
    }, r;
  })()
);
ch(pt);
JS(pt);
ie(pt, jw);
ie(pt, ex);
ie(pt, ib);
ie(pt, Qw);
var rx = Math.round(Math.random() * 10);
function Vs(r) {
  return [r || "", rx++].join("_");
}
function ix(r) {
  var t = {};
  r.registerSubTypeDefaulter = function(e, i) {
    var n = Ge(e);
    t[n.main] = i;
  }, r.determineSubType = function(e, i) {
    var n = i.type;
    if (!n) {
      var a = Ge(e).main;
      r.hasSubTypes(e) && t[a] && (n = t[a](i));
    }
    return n;
  };
}
function nx(r, t) {
  r.topologicalTravel = function(a, o, s, l) {
    if (!a.length)
      return;
    var u = e(o), f = u.graph, h = u.noEntryList, c = {};
    for (T(a, function(m) {
      c[m] = !0;
    }); h.length; ) {
      var v = h.pop(), p = f[v], g = !!c[v];
      g && (s.call(l, v, p.originalDeps.slice()), delete c[v]), T(p.successor, g ? y : d);
    }
    T(c, function() {
      var m = "";
      throw new Error(m);
    });
    function d(m) {
      f[m].entryCount--, f[m].entryCount === 0 && h.push(m);
    }
    function y(m) {
      c[m] = !0, d(m);
    }
  };
  function e(a) {
    var o = {}, s = [];
    return T(a, function(l) {
      var u = i(o, l), f = u.originalDeps = t(l), h = n(f, a);
      u.entryCount = h.length, u.entryCount === 0 && s.push(l), T(h, function(c) {
        nt(u.predecessor, c) < 0 && u.predecessor.push(c);
        var v = i(o, c);
        nt(v.successor, c) < 0 && v.successor.push(l);
      });
    }), {
      graph: o,
      noEntryList: s
    };
  }
  function i(a, o) {
    return a[o] || (a[o] = {
      predecessor: [],
      successor: []
    }), a[o];
  }
  function n(a, o) {
    var s = [];
    return T(a, function(l) {
      nt(o, l) >= 0 && s.push(l);
    }), s;
  }
}
function Hs(r, t) {
  return j(j({}, r, !0), t, !0);
}
const ax = {
  time: {
    month: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    monthAbbr: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    dayOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    dayOfWeekAbbr: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  },
  legend: {
    selector: {
      all: "All",
      inverse: "Inv"
    }
  },
  toolbox: {
    brush: {
      title: {
        rect: "Box Select",
        polygon: "Lasso Select",
        lineX: "Horizontally Select",
        lineY: "Vertically Select",
        keep: "Keep Selections",
        clear: "Clear Selections"
      }
    },
    dataView: {
      title: "Data View",
      lang: ["Data View", "Close", "Refresh"]
    },
    dataZoom: {
      title: {
        zoom: "Zoom",
        back: "Zoom Reset"
      }
    },
    magicType: {
      title: {
        line: "Switch to Line Chart",
        bar: "Switch to Bar Chart",
        stack: "Stack",
        tiled: "Tile"
      }
    },
    restore: {
      title: "Restore"
    },
    saveAsImage: {
      title: "Save as Image",
      lang: ["Right Click to Save Image"]
    }
  },
  series: {
    typeNames: {
      pie: "Pie chart",
      bar: "Bar chart",
      line: "Line chart",
      scatter: "Scatter plot",
      effectScatter: "Ripple scatter plot",
      radar: "Radar chart",
      tree: "Tree",
      treemap: "Treemap",
      boxplot: "Boxplot",
      candlestick: "Candlestick",
      k: "K line chart",
      heatmap: "Heat map",
      map: "Map",
      parallel: "Parallel coordinate map",
      lines: "Line graph",
      graph: "Relationship graph",
      sankey: "Sankey diagram",
      funnel: "Funnel chart",
      gauge: "Gauge",
      pictorialBar: "Pictorial bar",
      themeRiver: "Theme River Map",
      sunburst: "Sunburst",
      custom: "Custom chart",
      chart: "Chart"
    }
  },
  aria: {
    general: {
      withTitle: 'This is a chart about "{title}"',
      withoutTitle: "This is a chart"
    },
    series: {
      single: {
        prefix: "",
        withName: " with type {seriesType} named {seriesName}.",
        withoutName: " with type {seriesType}."
      },
      multiple: {
        prefix: ". It consists of {seriesCount} series count.",
        withName: " The {seriesId} series is a {seriesType} representing {seriesName}.",
        withoutName: " The {seriesId} series is a {seriesType}.",
        separator: {
          middle: "",
          end: ""
        }
      }
    },
    data: {
      allData: "The data is as follows: ",
      partialData: "The first {displayCnt} items are: ",
      withName: "the data for {name} is {value}",
      withoutName: "{value}",
      separator: {
        middle: ", ",
        end: ". "
      }
    }
  }
}, ox = {
  time: {
    month: ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"],
    monthAbbr: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
    dayOfWeek: ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"],
    dayOfWeekAbbr: ["日", "一", "二", "三", "四", "五", "六"]
  },
  legend: {
    selector: {
      all: "全选",
      inverse: "反选"
    }
  },
  toolbox: {
    brush: {
      title: {
        rect: "矩形选择",
        polygon: "圈选",
        lineX: "横向选择",
        lineY: "纵向选择",
        keep: "保持选择",
        clear: "清除选择"
      }
    },
    dataView: {
      title: "数据视图",
      lang: ["数据视图", "关闭", "刷新"]
    },
    dataZoom: {
      title: {
        zoom: "区域缩放",
        back: "区域缩放还原"
      }
    },
    magicType: {
      title: {
        line: "切换为折线图",
        bar: "切换为柱状图",
        stack: "切换为堆叠",
        tiled: "切换为平铺"
      }
    },
    restore: {
      title: "还原"
    },
    saveAsImage: {
      title: "保存为图片",
      lang: ["右键另存为图片"]
    }
  },
  series: {
    typeNames: {
      pie: "饼图",
      bar: "柱状图",
      line: "折线图",
      scatter: "散点图",
      effectScatter: "涟漪散点图",
      radar: "雷达图",
      tree: "树图",
      treemap: "矩形树图",
      boxplot: "箱型图",
      candlestick: "K线图",
      k: "K线图",
      heatmap: "热力图",
      map: "地图",
      parallel: "平行坐标图",
      lines: "线图",
      graph: "关系图",
      sankey: "桑基图",
      funnel: "漏斗图",
      gauge: "仪表盘图",
      pictorialBar: "象形柱图",
      themeRiver: "主题河流图",
      sunburst: "旭日图",
      custom: "自定义图表",
      chart: "图表"
    }
  },
  aria: {
    general: {
      withTitle: "这是一个关于“{title}”的图表。",
      withoutTitle: "这是一个图表，"
    },
    series: {
      single: {
        prefix: "",
        withName: "图表类型是{seriesType}，表示{seriesName}。",
        withoutName: "图表类型是{seriesType}。"
      },
      multiple: {
        prefix: "它由{seriesCount}个图表系列组成。",
        withName: "第{seriesId}个系列是一个表示{seriesName}的{seriesType}，",
        withoutName: "第{seriesId}个系列是一个{seriesType}，",
        separator: {
          middle: "；",
          end: "。"
        }
      }
    },
    data: {
      allData: "其数据是——",
      partialData: "其中，前{displayCnt}项是——",
      withName: "{name}的数据是{value}",
      withoutName: "{value}",
      separator: {
        middle: "，",
        end: ""
      }
    }
  }
};
var as = "ZH", xh = "EN", Xi = xh, Bo = {}, Th = {}, qy = Y.domSupported ? (function() {
  var r = (
    /* eslint-disable-next-line */
    (document.documentElement.lang || navigator.language || navigator.browserLanguage || Xi).toUpperCase()
  );
  return r.indexOf(as) > -1 ? as : Xi;
})() : Xi;
function Ch(r, t) {
  r = r.toUpperCase(), Th[r] = new pt(t), Bo[r] = t;
}
function sx(r) {
  if (V(r)) {
    var t = Bo[r.toUpperCase()] || {};
    return r === as || r === xh ? U(t) : j(U(t), U(Bo[Xi]), !1);
  } else
    return j(U(r), U(Bo[Xi]), !1);
}
function lx(r) {
  return Th[r];
}
function ux() {
  return Th[Xi];
}
Ch(xh, ax);
Ch(as, ox);
var Mh = 1e3, Dh = Mh * 60, $n = Dh * 60, ce = $n * 24, Ic = ce * 365, kn = {
  year: "{yyyy}",
  month: "{MMM}",
  day: "{d}",
  hour: "{HH}:{mm}",
  minute: "{HH}:{mm}",
  second: "{HH}:{mm}:{ss}",
  millisecond: "{HH}:{mm}:{ss} {SSS}",
  none: "{yyyy}-{MM}-{dd} {HH}:{mm}:{ss} {SSS}"
}, ja = "{yyyy}-{MM}-{dd}", Lc = {
  year: "{yyyy}",
  month: "{yyyy}-{MM}",
  day: ja,
  hour: ja + " " + kn.hour,
  minute: ja + " " + kn.minute,
  second: ja + " " + kn.second,
  millisecond: kn.none
}, Hl = ["year", "month", "day", "hour", "minute", "second", "millisecond"], Ky = ["year", "half-year", "quarter", "month", "week", "half-week", "day", "half-day", "quarter-day", "hour", "minute", "second", "millisecond"];
function zt(r, t) {
  return r += "", "0000".substr(0, t - r.length) + r;
}
function $i(r) {
  switch (r) {
    case "half-year":
    case "quarter":
      return "month";
    case "week":
    case "half-week":
      return "day";
    case "half-day":
    case "quarter-day":
      return "hour";
    default:
      return r;
  }
}
function fx(r) {
  return r === $i(r);
}
function hx(r) {
  switch (r) {
    case "year":
    case "month":
      return "day";
    case "millisecond":
      return "millisecond";
    default:
      return "second";
  }
}
function Pa(r, t, e, i) {
  var n = pe(r), a = n[Ah(e)](), o = n[Zi(e)]() + 1, s = Math.floor((o - 1) / 3) + 1, l = n[Gs(e)](), u = n["get" + (e ? "UTC" : "") + "Day"](), f = n[fa(e)](), h = (f - 1) % 12 + 1, c = n[Ws(e)](), v = n[Us(e)](), p = n[Ys(e)](), g = f >= 12 ? "pm" : "am", d = g.toUpperCase(), y = i instanceof pt ? i : lx(i || qy) || ux(), m = y.getModel("time"), _ = m.get("month"), S = m.get("monthAbbr"), w = m.get("dayOfWeek"), b = m.get("dayOfWeekAbbr");
  return (t || "").replace(/{a}/g, g + "").replace(/{A}/g, d + "").replace(/{yyyy}/g, a + "").replace(/{yy}/g, zt(a % 100 + "", 2)).replace(/{Q}/g, s + "").replace(/{MMMM}/g, _[o - 1]).replace(/{MMM}/g, S[o - 1]).replace(/{MM}/g, zt(o, 2)).replace(/{M}/g, o + "").replace(/{dd}/g, zt(l, 2)).replace(/{d}/g, l + "").replace(/{eeee}/g, w[u]).replace(/{ee}/g, b[u]).replace(/{e}/g, u + "").replace(/{HH}/g, zt(f, 2)).replace(/{H}/g, f + "").replace(/{hh}/g, zt(h + "", 2)).replace(/{h}/g, h + "").replace(/{mm}/g, zt(c, 2)).replace(/{m}/g, c + "").replace(/{ss}/g, zt(v, 2)).replace(/{s}/g, v + "").replace(/{SSS}/g, zt(p, 3)).replace(/{S}/g, p + "");
}
function vx(r, t, e, i, n) {
  var a = null;
  if (V(e))
    a = e;
  else if (X(e))
    a = e(r.value, t, {
      level: r.level
    });
  else {
    var o = k({}, kn);
    if (r.level > 0)
      for (var s = 0; s < Hl.length; ++s)
        o[Hl[s]] = "{primary|" + o[Hl[s]] + "}";
    var l = e ? e.inherit === !1 ? e : at(e, o) : o, u = Qy(r.value, n);
    if (l[u])
      a = l[u];
    else if (l.inherit) {
      for (var f = Ky.indexOf(u), s = f - 1; s >= 0; --s)
        if (l[u]) {
          a = l[u];
          break;
        }
      a = a || o.none;
    }
    if (O(a)) {
      var h = r.level == null ? 0 : r.level >= 0 ? r.level : a.length + r.level;
      h = Math.min(h, a.length - 1), a = a[h];
    }
  }
  return Pa(new Date(r.value), a, n, i);
}
function Qy(r, t) {
  var e = pe(r), i = e[Zi(t)]() + 1, n = e[Gs(t)](), a = e[fa(t)](), o = e[Ws(t)](), s = e[Us(t)](), l = e[Ys(t)](), u = l === 0, f = u && s === 0, h = f && o === 0, c = h && a === 0, v = c && n === 1, p = v && i === 1;
  return p ? "year" : v ? "month" : c ? "day" : h ? "hour" : f ? "minute" : u ? "second" : "millisecond";
}
function Pc(r, t, e) {
  var i = vt(r) ? pe(r) : r;
  switch (t = t || Qy(r, e), t) {
    case "year":
      return i[Ah(e)]();
    case "half-year":
      return i[Zi(e)]() >= 6 ? 1 : 0;
    case "quarter":
      return Math.floor((i[Zi(e)]() + 1) / 4);
    case "month":
      return i[Zi(e)]();
    case "day":
      return i[Gs(e)]();
    case "half-day":
      return i[fa(e)]() / 24;
    case "hour":
      return i[fa(e)]();
    case "minute":
      return i[Ws(e)]();
    case "second":
      return i[Us(e)]();
    case "millisecond":
      return i[Ys(e)]();
  }
}
function Ah(r) {
  return r ? "getUTCFullYear" : "getFullYear";
}
function Zi(r) {
  return r ? "getUTCMonth" : "getMonth";
}
function Gs(r) {
  return r ? "getUTCDate" : "getDate";
}
function fa(r) {
  return r ? "getUTCHours" : "getHours";
}
function Ws(r) {
  return r ? "getUTCMinutes" : "getMinutes";
}
function Us(r) {
  return r ? "getUTCSeconds" : "getSeconds";
}
function Ys(r) {
  return r ? "getUTCMilliseconds" : "getMilliseconds";
}
function cx(r) {
  return r ? "setUTCFullYear" : "setFullYear";
}
function Jy(r) {
  return r ? "setUTCMonth" : "setMonth";
}
function jy(r) {
  return r ? "setUTCDate" : "setDate";
}
function tm(r) {
  return r ? "setUTCHours" : "setHours";
}
function em(r) {
  return r ? "setUTCMinutes" : "setMinutes";
}
function rm(r) {
  return r ? "setUTCSeconds" : "setSeconds";
}
function im(r) {
  return r ? "setUTCMilliseconds" : "setMilliseconds";
}
function px(r, t, e, i, n, a, o, s) {
  var l = new mt({
    style: {
      text: r,
      font: t,
      align: e,
      verticalAlign: i,
      padding: n,
      rich: a,
      overflow: o ? "truncate" : null,
      lineHeight: s
    }
  });
  return l.getBoundingRect();
}
function Ih(r) {
  if (!ey(r))
    return V(r) ? r : "-";
  var t = (r + "").split(".");
  return t[0].replace(/(\d{1,3})(?=(?:\d{3})+(?!\d))/g, "$1,") + (t.length > 1 ? "." + t[1] : "");
}
function Lh(r, t) {
  return r = (r || "").toLowerCase().replace(/-(.)/g, function(e, i) {
    return i.toUpperCase();
  }), t && r && (r = r.charAt(0).toUpperCase() + r.slice(1)), r;
}
var an = Kf;
function vf(r, t, e) {
  var i = "{yyyy}-{MM}-{dd} {HH}:{mm}:{ss}";
  function n(f) {
    return f && Me(f) ? f : "-";
  }
  function a(f) {
    return !!(f != null && !isNaN(f) && isFinite(f));
  }
  var o = t === "time", s = r instanceof Date;
  if (o || s) {
    var l = o ? pe(r) : r;
    if (isNaN(+l)) {
      if (s)
        return "-";
    } else return Pa(l, i, e);
  }
  if (t === "ordinal")
    return Go(r) ? n(r) : vt(r) && a(r) ? r + "" : "-";
  var u = na(r);
  return a(u) ? Ih(u) : Go(r) ? n(r) : typeof r == "boolean" ? r + "" : "-";
}
var Rc = ["a", "b", "c", "d", "e", "f", "g"], Gl = function(r, t) {
  return "{" + r + (t ?? "") + "}";
};
function Ph(r, t, e) {
  O(t) || (t = [t]);
  var i = t.length;
  if (!i)
    return "";
  for (var n = t[0].$vars || [], a = 0; a < n.length; a++) {
    var o = Rc[a];
    r = r.replace(Gl(o), Gl(o, 0));
  }
  for (var s = 0; s < i; s++)
    for (var l = 0; l < n.length; l++) {
      var u = t[s][n[l]];
      r = r.replace(Gl(Rc[l], s), e ? Ft(u) : u);
    }
  return r;
}
function nm(r, t) {
  var e = V(r) ? {
    color: r,
    extraCssText: t
  } : r || {}, i = e.color, n = e.type;
  t = e.extraCssText;
  var a = e.renderMode || "html";
  if (!i)
    return "";
  if (a === "html")
    return n === "subItem" ? '<span style="display:inline-block;vertical-align:middle;margin-right:8px;margin-left:3px;border-radius:4px;width:4px;height:4px;background-color:' + Ft(i) + ";" + (t || "") + '"></span>' : '<span style="display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:' + Ft(i) + ";" + (t || "") + '"></span>';
  var o = e.markerId || "markerX";
  return {
    renderMode: a,
    content: "{" + o + "|}  ",
    style: n === "subItem" ? {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: i
    } : {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: i
    }
  };
}
function dx(r, t, e) {
  (r === "week" || r === "month" || r === "quarter" || r === "half-year" || r === "year") && (r = `MM-dd
yyyy`);
  var i = pe(t), n = e ? "getUTC" : "get", a = i[n + "FullYear"](), o = i[n + "Month"]() + 1, s = i[n + "Date"](), l = i[n + "Hours"](), u = i[n + "Minutes"](), f = i[n + "Seconds"](), h = i[n + "Milliseconds"]();
  return r = r.replace("MM", zt(o, 2)).replace("M", o).replace("yyyy", a).replace("yy", zt(a % 100 + "", 2)).replace("dd", zt(s, 2)).replace("d", s).replace("hh", zt(l, 2)).replace("h", l).replace("mm", zt(u, 2)).replace("m", u).replace("ss", zt(f, 2)).replace("s", f).replace("SSS", zt(h, 3)), r;
}
function gx(r) {
  return r && r.charAt(0).toUpperCase() + r.substr(1);
}
function di(r, t) {
  return t = t || "transparent", V(r) ? r : H(r) && r.colorStops && (r.colorStops[0] || {}).color || t;
}
function Ec(r, t) {
  if (t === "_blank" || t === "blank") {
    var e = window.open();
    e.opener = null, e.location.href = r;
  } else
    window.open(r, t);
}
var zo = T, yx = ["left", "right", "top", "bottom", "width", "height"], to = [["width", "left", "right"], ["height", "top", "bottom"]];
function Rh(r, t, e, i, n) {
  var a = 0, o = 0;
  i == null && (i = 1 / 0), n == null && (n = 1 / 0);
  var s = 0;
  t.eachChild(function(l, u) {
    var f = l.getBoundingRect(), h = t.childAt(u + 1), c = h && h.getBoundingRect(), v, p;
    if (r === "horizontal") {
      var g = f.width + (c ? -c.x + f.x : 0);
      v = a + g, v > i || l.newline ? (a = 0, v = g, o += s + e, s = f.height) : s = Math.max(s, f.height);
    } else {
      var d = f.height + (c ? -c.y + f.y : 0);
      p = o + d, p > n || l.newline ? (a += s + e, o = 0, p = d, s = f.width) : s = Math.max(s, f.width);
    }
    l.newline || (l.x = a, l.y = o, l.markRedraw(), r === "horizontal" ? a = v + e : o = p + e);
  });
}
var qi = Rh;
ht(Rh, "vertical");
ht(Rh, "horizontal");
function Ar(r, t, e) {
  e = an(e || 0);
  var i = t.width, n = t.height, a = Mt(r.left, i), o = Mt(r.top, n), s = Mt(r.right, i), l = Mt(r.bottom, n), u = Mt(r.width, i), f = Mt(r.height, n), h = e[2] + e[0], c = e[1] + e[3], v = r.aspect;
  switch (isNaN(u) && (u = i - s - c - a), isNaN(f) && (f = n - l - h - o), v != null && (isNaN(u) && isNaN(f) && (v > i / n ? u = i * 0.8 : f = n * 0.8), isNaN(u) && (u = v * f), isNaN(f) && (f = u / v)), isNaN(a) && (a = i - s - u - c), isNaN(o) && (o = n - l - f - h), r.left || r.right) {
    case "center":
      a = i / 2 - u / 2 - e[3];
      break;
    case "right":
      a = i - u - c;
      break;
  }
  switch (r.top || r.bottom) {
    case "middle":
    case "center":
      o = n / 2 - f / 2 - e[0];
      break;
    case "bottom":
      o = n - f - h;
      break;
  }
  a = a || 0, o = o || 0, isNaN(u) && (u = i - c - a - (s || 0)), isNaN(f) && (f = n - h - o - (l || 0));
  var p = new it(a + e[3], o + e[0], u, f);
  return p.margin = e, p;
}
function mx(r, t, e, i, n, a) {
  a = a || r, a.x = r.x, a.y = r.y;
  var o;
  if (o = r.getBoundingRect(), r.needLocalTransform()) {
    var s = r.getLocalTransform();
    o = o.clone(), o.applyTransform(s);
  }
  var l = Ar(at({
    width: o.width,
    height: o.height
  }, t), e, i), u = l.x - o.x, f = l.y - o.y;
  return a.x += u, a.y += f, a === r && r.markRedraw(), !0;
}
function ha(r) {
  var t = r.layoutMode || r.constructor.layoutMode;
  return H(t) ? t : t ? {
    type: t
  } : null;
}
function ji(r, t, e) {
  var i = e && e.ignoreSize;
  !O(i) && (i = [i, i]);
  var n = o(to[0], 0), a = o(to[1], 1);
  u(to[0], r, n), u(to[1], r, a);
  function o(f, h) {
    var c = {}, v = 0, p = {}, g = 0, d = 2;
    if (zo(f, function(_) {
      p[_] = r[_];
    }), zo(f, function(_) {
      s(t, _) && (c[_] = p[_] = t[_]), l(c, _) && v++, l(p, _) && g++;
    }), i[h])
      return l(t, f[1]) ? p[f[2]] = null : l(t, f[2]) && (p[f[1]] = null), p;
    if (g === d || !v)
      return p;
    if (v >= d)
      return c;
    for (var y = 0; y < f.length; y++) {
      var m = f[y];
      if (!s(c, m) && s(r, m)) {
        c[m] = r[m];
        break;
      }
    }
    return c;
  }
  function s(f, h) {
    return f.hasOwnProperty(h);
  }
  function l(f, h) {
    return f[h] != null && f[h] !== "auto";
  }
  function u(f, h, c) {
    zo(f, function(v) {
      h[v] = c[v];
    });
  }
}
function Xs(r) {
  return _x({}, r);
}
function _x(r, t) {
  return t && r && zo(yx, function(e) {
    t.hasOwnProperty(e) && (r[e] = t[e]);
  }), r;
}
var Sx = bt(), rt = (
  /** @class */
  (function(r) {
    F(t, r);
    function t(e, i, n) {
      var a = r.call(this, e, i, n) || this;
      return a.uid = Vs("ec_cpt_model"), a;
    }
    return t.prototype.init = function(e, i, n) {
      this.mergeDefaultAndTheme(e, n);
    }, t.prototype.mergeDefaultAndTheme = function(e, i) {
      var n = ha(this), a = n ? Xs(e) : {}, o = i.getTheme();
      j(e, o.get(this.mainType)), j(e, this.getDefaultOption()), n && ji(e, a, n);
    }, t.prototype.mergeOption = function(e, i) {
      j(this.option, e, !0);
      var n = ha(this);
      n && ji(this.option, e, n);
    }, t.prototype.optionUpdated = function(e, i) {
    }, t.prototype.getDefaultOption = function() {
      var e = this.constructor;
      if (!qS(e))
        return e.defaultOption;
      var i = Sx(this);
      if (!i.defaultOption) {
        for (var n = [], a = e; a; ) {
          var o = a.prototype.defaultOption;
          o && n.push(o), a = a.superClass;
        }
        for (var s = {}, l = n.length - 1; l >= 0; l--)
          s = j(s, n[l], !0);
        i.defaultOption = s;
      }
      return i.defaultOption;
    }, t.prototype.getReferringComponents = function(e, i) {
      var n = e + "Index", a = e + "Id";
      return Ca(this.ecModel, e, {
        index: this.get(n, !0),
        id: this.get(a, !0)
      }, i);
    }, t.prototype.getBoxLayoutParams = function() {
      var e = this;
      return {
        left: e.get("left"),
        top: e.get("top"),
        right: e.get("right"),
        bottom: e.get("bottom"),
        width: e.get("width"),
        height: e.get("height")
      };
    }, t.prototype.getZLevelKey = function() {
      return "";
    }, t.prototype.setZLevel = function(e) {
      this.option.zlevel = e;
    }, t.protoInitialize = (function() {
      var e = t.prototype;
      e.type = "component", e.id = "", e.name = "", e.mainType = "", e.subType = "", e.componentIndex = 0;
    })(), t;
  })(pt)
);
ly(rt, pt);
Cs(rt);
ix(rt);
nx(rt, bx);
function bx(r) {
  var t = [];
  return T(rt.getClassesByMainType(r), function(e) {
    t = t.concat(e.dependencies || e.prototype.dependencies || []);
  }), t = z(t, function(e) {
    return Ge(e).main;
  }), r !== "dataset" && nt(t, "dataset") <= 0 && t.unshift("dataset"), t;
}
var am = "";
typeof navigator < "u" && (am = navigator.platform || "");
var Ii = "rgba(0, 0, 0, 0.2)";
const xx = {
  darkMode: "auto",
  // backgroundColor: 'rgba(0,0,0,0)',
  colorBy: "series",
  color: ["#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de", "#3ba272", "#fc8452", "#9a60b4", "#ea7ccc"],
  gradientColor: ["#f6efa6", "#d88273", "#bf444c"],
  aria: {
    decal: {
      decals: [{
        color: Ii,
        dashArrayX: [1, 0],
        dashArrayY: [2, 5],
        symbolSize: 1,
        rotation: Math.PI / 6
      }, {
        color: Ii,
        symbol: "circle",
        dashArrayX: [[8, 8], [0, 8, 8, 0]],
        dashArrayY: [6, 0],
        symbolSize: 0.8
      }, {
        color: Ii,
        dashArrayX: [1, 0],
        dashArrayY: [4, 3],
        rotation: -Math.PI / 4
      }, {
        color: Ii,
        dashArrayX: [[6, 6], [0, 6, 6, 0]],
        dashArrayY: [6, 0]
      }, {
        color: Ii,
        dashArrayX: [[1, 0], [1, 6]],
        dashArrayY: [1, 0, 6, 0],
        rotation: Math.PI / 4
      }, {
        color: Ii,
        symbol: "triangle",
        dashArrayX: [[9, 9], [0, 9, 9, 0]],
        dashArrayY: [7, 2],
        symbolSize: 0.75
      }]
    }
  },
  // If xAxis and yAxis declared, grid is created by default.
  // grid: {},
  textStyle: {
    // color: '#000',
    // decoration: 'none',
    // PENDING
    fontFamily: am.match(/^Win/) ? "Microsoft YaHei" : "sans-serif",
    // fontFamily: 'Arial, Verdana, sans-serif',
    fontSize: 12,
    fontStyle: "normal",
    fontWeight: "normal"
  },
  // http://blogs.adobe.com/webplatform/2014/02/24/using-blend-modes-in-html-canvas/
  // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation
  // Default is source-over
  blendMode: null,
  stateAnimation: {
    duration: 300,
    easing: "cubicOut"
  },
  animation: "auto",
  animationDuration: 1e3,
  animationDurationUpdate: 500,
  animationEasing: "cubicInOut",
  animationEasingUpdate: "cubicInOut",
  animationThreshold: 2e3,
  // Configuration for progressive/incremental rendering
  progressiveThreshold: 3e3,
  progressive: 400,
  // Threshold of if use single hover layer to optimize.
  // It is recommended that `hoverLayerThreshold` is equivalent to or less than
  // `progressiveThreshold`, otherwise hover will cause restart of progressive,
  // which is unexpected.
  // see example <echarts/test/heatmap-large.html>.
  hoverLayerThreshold: 3e3,
  // See: module:echarts/scale/Time
  useUTC: !1
};
var om = q(["tooltip", "label", "itemName", "itemId", "itemGroupId", "itemChildGroupId", "seriesName"]), _e = "original", Qt = "arrayRows", Ze = "objectRows", nr = "keyedColumns", xr = "typedArray", sm = "unknown", rr = "column", on = "row", jt = {
  Must: 1,
  Might: 2,
  Not: 3
  // Other cases
}, lm = bt();
function Tx(r) {
  lm(r).datasetMap = q();
}
function Cx(r, t, e) {
  var i = {}, n = um(t);
  if (!n || !r)
    return i;
  var a = [], o = [], s = t.ecModel, l = lm(s).datasetMap, u = n.uid + "_" + e.seriesLayoutBy, f, h;
  r = r.slice(), T(r, function(g, d) {
    var y = H(g) ? g : r[d] = {
      name: g
    };
    y.type === "ordinal" && f == null && (f = d, h = p(y)), i[y.name] = [];
  });
  var c = l.get(u) || l.set(u, {
    categoryWayDim: h,
    valueWayDim: 0
  });
  T(r, function(g, d) {
    var y = g.name, m = p(g);
    if (f == null) {
      var _ = c.valueWayDim;
      v(i[y], _, m), v(o, _, m), c.valueWayDim += m;
    } else if (f === d)
      v(i[y], 0, m), v(a, 0, m);
    else {
      var _ = c.categoryWayDim;
      v(i[y], _, m), v(o, _, m), c.categoryWayDim += m;
    }
  });
  function v(g, d, y) {
    for (var m = 0; m < y; m++)
      g.push(d + m);
  }
  function p(g) {
    var d = g.dimsDef;
    return d ? d.length : 1;
  }
  return a.length && (i.itemName = a), o.length && (i.seriesName = o), i;
}
function um(r) {
  var t = r.get("data", !0);
  if (!t)
    return Ca(r.ecModel, "dataset", {
      index: r.get("datasetIndex", !0),
      id: r.get("datasetId", !0)
    }, Ae).models[0];
}
function Mx(r) {
  return !r.get("transform", !0) && !r.get("fromTransformResult", !0) ? [] : Ca(r.ecModel, "dataset", {
    index: r.get("fromDatasetIndex", !0),
    id: r.get("fromDatasetId", !0)
  }, Ae).models;
}
function fm(r, t) {
  return Dx(r.data, r.sourceFormat, r.seriesLayoutBy, r.dimensionsDefine, r.startIndex, t);
}
function Dx(r, t, e, i, n, a) {
  var o, s = 5;
  if (Gt(r))
    return jt.Not;
  var l, u;
  if (i) {
    var f = i[a];
    H(f) ? (l = f.name, u = f.type) : V(f) && (l = f);
  }
  if (u != null)
    return u === "ordinal" ? jt.Must : jt.Not;
  if (t === Qt) {
    var h = r;
    if (e === on) {
      for (var c = h[a], v = 0; v < (c || []).length && v < s; v++)
        if ((o = S(c[n + v])) != null)
          return o;
    } else
      for (var v = 0; v < h.length && v < s; v++) {
        var p = h[n + v];
        if (p && (o = S(p[a])) != null)
          return o;
      }
  } else if (t === Ze) {
    var g = r;
    if (!l)
      return jt.Not;
    for (var v = 0; v < g.length && v < s; v++) {
      var d = g[v];
      if (d && (o = S(d[l])) != null)
        return o;
    }
  } else if (t === nr) {
    var y = r;
    if (!l)
      return jt.Not;
    var c = y[l];
    if (!c || Gt(c))
      return jt.Not;
    for (var v = 0; v < c.length && v < s; v++)
      if ((o = S(c[v])) != null)
        return o;
  } else if (t === _e)
    for (var m = r, v = 0; v < m.length && v < s; v++) {
      var d = m[v], _ = Ta(d);
      if (!O(_))
        return jt.Not;
      if ((o = S(_[a])) != null)
        return o;
    }
  function S(w) {
    var b = V(w);
    if (w != null && Number.isFinite(Number(w)) && w !== "")
      return b ? jt.Might : jt.Not;
    if (b && w !== "-")
      return jt.Must;
  }
  return jt.Not;
}
var Ax = q();
function Ix(r, t, e) {
  var i = Ax.get(t);
  if (!i)
    return e;
  var n = i(r);
  return n ? e.concat(n) : e;
}
var Oc = bt();
bt();
var Eh = (
  /** @class */
  (function() {
    function r() {
    }
    return r.prototype.getColorFromPalette = function(t, e, i) {
      var n = Dt(this.get("color", !0)), a = this.get("colorLayer", !0);
      return Px(this, Oc, n, a, t, e, i);
    }, r.prototype.clearColorPalette = function() {
      Rx(this, Oc);
    }, r;
  })()
);
function Lx(r, t) {
  for (var e = r.length, i = 0; i < e; i++)
    if (r[i].length > t)
      return r[i];
  return r[e - 1];
}
function Px(r, t, e, i, n, a, o) {
  a = a || r;
  var s = t(a), l = s.paletteIdx || 0, u = s.paletteNameMap = s.paletteNameMap || {};
  if (u.hasOwnProperty(n))
    return u[n];
  var f = o == null || !i ? e : Lx(i, o);
  if (f = f || e, !(!f || !f.length)) {
    var h = f[l];
    return n && (u[n] = h), s.paletteIdx = (l + 1) % f.length, h;
  }
}
function Rx(r, t) {
  t(r).paletteIdx = 0, t(r).paletteNameMap = {};
}
var eo, mn, kc, Nc = "\0_ec_inner", Ex = 1, Oh = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      return r !== null && r.apply(this, arguments) || this;
    }
    return t.prototype.init = function(e, i, n, a, o, s) {
      a = a || {}, this.option = null, this._theme = new pt(a), this._locale = new pt(o), this._optionManager = s;
    }, t.prototype.setOption = function(e, i, n) {
      var a = Fc(i);
      this._optionManager.setOption(e, n, a), this._resetOption(null, a);
    }, t.prototype.resetOption = function(e, i) {
      return this._resetOption(e, Fc(i));
    }, t.prototype._resetOption = function(e, i) {
      var n = !1, a = this._optionManager;
      if (!e || e === "recreate") {
        var o = a.mountOption(e === "recreate");
        !this.option || e === "recreate" ? kc(this, o) : (this.restoreData(), this._mergeOption(o, i)), n = !0;
      }
      if ((e === "timeline" || e === "media") && this.restoreData(), !e || e === "recreate" || e === "timeline") {
        var s = a.getTimelineOption(this);
        s && (n = !0, this._mergeOption(s, i));
      }
      if (!e || e === "recreate" || e === "media") {
        var l = a.getMediaOption(this);
        l.length && T(l, function(u) {
          n = !0, this._mergeOption(u, i);
        }, this);
      }
      return n;
    }, t.prototype.mergeOption = function(e) {
      this._mergeOption(e, null);
    }, t.prototype._mergeOption = function(e, i) {
      var n = this.option, a = this._componentsMap, o = this._componentsCount, s = [], l = q(), u = i && i.replaceMergeMainTypeMap;
      Tx(this), T(e, function(h, c) {
        h != null && (rt.hasClass(c) ? c && (s.push(c), l.set(c, !0)) : n[c] = n[c] == null ? U(h) : j(n[c], h, !0));
      }), u && u.each(function(h, c) {
        rt.hasClass(c) && !l.get(c) && (s.push(c), l.set(c, !0));
      }), rt.topologicalTravel(s, rt.getAllClassMainTypes(), f, this);
      function f(h) {
        var c = Ix(this, h, Dt(e[h])), v = a.get(h), p = (
          // `!oldCmptList` means init. See the comment in `mappingToExists`
          v ? u && u.get(h) ? "replaceMerge" : "normalMerge" : "replaceAll"
        ), g = ES(v, c, p);
        VS(g, h, rt), n[h] = null, a.set(h, null), o.set(h, 0);
        var d = [], y = [], m = 0, _;
        T(g, function(S, w) {
          var b = S.existing, x = S.newOption;
          if (!x)
            b && (b.mergeOption({}, this), b.optionUpdated({}, !1));
          else {
            var M = h === "series", D = rt.getClass(
              h,
              S.keyInfo.subType,
              !M
              // Give a more detailed warn later if series don't exists
            );
            if (!D)
              return;
            if (h === "tooltip") {
              if (_)
                return;
              _ = !0;
            }
            if (b && b.constructor === D)
              b.name = S.keyInfo.name, b.mergeOption(x, this), b.optionUpdated(x, !1);
            else {
              var A = k({
                componentIndex: w
              }, S.keyInfo);
              b = new D(x, this, this, A), k(b, A), S.brandNew && (b.__requireNewView = !0), b.init(x, this, this), b.optionUpdated(null, !0);
            }
          }
          b ? (d.push(b.option), y.push(b), m++) : (d.push(void 0), y.push(void 0));
        }, this), n[h] = d, a.set(h, y), o.set(h, m), h === "series" && eo(this);
      }
      this._seriesIndices || eo(this);
    }, t.prototype.getOption = function() {
      var e = U(this.option);
      return T(e, function(i, n) {
        if (rt.hasClass(n)) {
          for (var a = Dt(i), o = a.length, s = !1, l = o - 1; l >= 0; l--)
            a[l] && !aa(a[l]) ? s = !0 : (a[l] = null, !s && o--);
          a.length = o, e[n] = a;
        }
      }), delete e[Nc], e;
    }, t.prototype.getTheme = function() {
      return this._theme;
    }, t.prototype.getLocaleModel = function() {
      return this._locale;
    }, t.prototype.setUpdatePayload = function(e) {
      this._payload = e;
    }, t.prototype.getUpdatePayload = function() {
      return this._payload;
    }, t.prototype.getComponent = function(e, i) {
      var n = this._componentsMap.get(e);
      if (n) {
        var a = n[i || 0];
        if (a)
          return a;
        if (i == null) {
          for (var o = 0; o < n.length; o++)
            if (n[o])
              return n[o];
        }
      }
    }, t.prototype.queryComponents = function(e) {
      var i = e.mainType;
      if (!i)
        return [];
      var n = e.index, a = e.id, o = e.name, s = this._componentsMap.get(i);
      if (!s || !s.length)
        return [];
      var l;
      return n != null ? (l = [], T(Dt(n), function(u) {
        s[u] && l.push(s[u]);
      })) : a != null ? l = Bc("id", a, s) : o != null ? l = Bc("name", o, s) : l = xt(s, function(u) {
        return !!u;
      }), zc(l, e);
    }, t.prototype.findComponents = function(e) {
      var i = e.query, n = e.mainType, a = s(i), o = a ? this.queryComponents(a) : xt(this._componentsMap.get(n), function(u) {
        return !!u;
      });
      return l(zc(o, e));
      function s(u) {
        var f = n + "Index", h = n + "Id", c = n + "Name";
        return u && (u[f] != null || u[h] != null || u[c] != null) ? {
          mainType: n,
          // subType will be filtered finally.
          index: u[f],
          id: u[h],
          name: u[c]
        } : null;
      }
      function l(u) {
        return e.filter ? xt(u, e.filter) : u;
      }
    }, t.prototype.eachComponent = function(e, i, n) {
      var a = this._componentsMap;
      if (X(e)) {
        var o = i, s = e;
        a.each(function(h, c) {
          for (var v = 0; h && v < h.length; v++) {
            var p = h[v];
            p && s.call(o, c, p, p.componentIndex);
          }
        });
      } else
        for (var l = V(e) ? a.get(e) : H(e) ? this.findComponents(e) : null, u = 0; l && u < l.length; u++) {
          var f = l[u];
          f && i.call(n, f, f.componentIndex);
        }
    }, t.prototype.getSeriesByName = function(e) {
      var i = Pe(e, null);
      return xt(this._componentsMap.get("series"), function(n) {
        return !!n && i != null && n.name === i;
      });
    }, t.prototype.getSeriesByIndex = function(e) {
      return this._componentsMap.get("series")[e];
    }, t.prototype.getSeriesByType = function(e) {
      return xt(this._componentsMap.get("series"), function(i) {
        return !!i && i.subType === e;
      });
    }, t.prototype.getSeries = function() {
      return xt(this._componentsMap.get("series"), function(e) {
        return !!e;
      });
    }, t.prototype.getSeriesCount = function() {
      return this._componentsCount.get("series");
    }, t.prototype.eachSeries = function(e, i) {
      mn(this), T(this._seriesIndices, function(n) {
        var a = this._componentsMap.get("series")[n];
        e.call(i, a, n);
      }, this);
    }, t.prototype.eachRawSeries = function(e, i) {
      T(this._componentsMap.get("series"), function(n) {
        n && e.call(i, n, n.componentIndex);
      });
    }, t.prototype.eachSeriesByType = function(e, i, n) {
      mn(this), T(this._seriesIndices, function(a) {
        var o = this._componentsMap.get("series")[a];
        o.subType === e && i.call(n, o, a);
      }, this);
    }, t.prototype.eachRawSeriesByType = function(e, i, n) {
      return T(this.getSeriesByType(e), i, n);
    }, t.prototype.isSeriesFiltered = function(e) {
      return mn(this), this._seriesIndicesMap.get(e.componentIndex) == null;
    }, t.prototype.getCurrentSeriesIndices = function() {
      return (this._seriesIndices || []).slice();
    }, t.prototype.filterSeries = function(e, i) {
      mn(this);
      var n = [];
      T(this._seriesIndices, function(a) {
        var o = this._componentsMap.get("series")[a];
        e.call(i, o, a) && n.push(a);
      }, this), this._seriesIndices = n, this._seriesIndicesMap = q(n);
    }, t.prototype.restoreData = function(e) {
      eo(this);
      var i = this._componentsMap, n = [];
      i.each(function(a, o) {
        rt.hasClass(o) && n.push(o);
      }), rt.topologicalTravel(n, rt.getAllClassMainTypes(), function(a) {
        T(i.get(a), function(o) {
          o && (a !== "series" || !Ox(o, e)) && o.restoreData();
        });
      });
    }, t.internalField = (function() {
      eo = function(e) {
        var i = e._seriesIndices = [];
        T(e._componentsMap.get("series"), function(n) {
          n && i.push(n.componentIndex);
        }), e._seriesIndicesMap = q(i);
      }, mn = function(e) {
      }, kc = function(e, i) {
        e.option = {}, e.option[Nc] = Ex, e._componentsMap = q({
          series: []
        }), e._componentsCount = q();
        var n = i.aria;
        H(n) && n.enabled == null && (n.enabled = !0), kx(i, e._theme.option), j(i, xx, !1), e._mergeOption(i, null);
      };
    })(), t;
  })(pt)
);
function Ox(r, t) {
  if (t) {
    var e = t.seriesIndex, i = t.seriesId, n = t.seriesName;
    return e != null && r.componentIndex !== e || i != null && r.id !== i || n != null && r.name !== n;
  }
}
function kx(r, t) {
  var e = r.color && !r.colorLayer;
  T(t, function(i, n) {
    n === "colorLayer" && e || rt.hasClass(n) || (typeof i == "object" ? r[n] = r[n] ? j(r[n], i, !1) : U(i) : r[n] == null && (r[n] = i));
  });
}
function Bc(r, t, e) {
  if (O(t)) {
    var i = q();
    return T(t, function(a) {
      if (a != null) {
        var o = Pe(a, null);
        o != null && i.set(a, !0);
      }
    }), xt(e, function(a) {
      return a && i.get(a[r]);
    });
  } else {
    var n = Pe(t, null);
    return xt(e, function(a) {
      return a && n != null && a[r] === n;
    });
  }
}
function zc(r, t) {
  return t.hasOwnProperty("subType") ? xt(r, function(e) {
    return e && e.subType === t.subType;
  }) : r;
}
function Fc(r) {
  var t = q();
  return r && T(Dt(r.replaceMerge), function(e) {
    t.set(e, !0);
  }), {
    replaceMergeMainTypeMap: t
  };
}
ie(Oh, Eh);
var Nx = [
  "getDom",
  "getZr",
  "getWidth",
  "getHeight",
  "getDevicePixelRatio",
  "dispatchAction",
  "isSSR",
  "isDisposed",
  "on",
  "off",
  "getDataURL",
  "getConnectedDataURL",
  // 'getModel',
  "getOption",
  // 'getViewOfComponentModel',
  // 'getViewOfSeriesModel',
  "getId",
  "updateLabelLayout"
], hm = (
  /** @class */
  /* @__PURE__ */ (function() {
    function r(t) {
      T(Nx, function(e) {
        this[e] = Q(t[e], t);
      }, this);
    }
    return r;
  })()
), Wl = {}, Ra = (
  /** @class */
  (function() {
    function r() {
      this._coordinateSystems = [];
    }
    return r.prototype.create = function(t, e) {
      var i = [];
      T(Wl, function(n, a) {
        var o = n.create(t, e);
        i = i.concat(o || []);
      }), this._coordinateSystems = i;
    }, r.prototype.update = function(t, e) {
      T(this._coordinateSystems, function(i) {
        i.update && i.update(t, e);
      });
    }, r.prototype.getCoordinateSystems = function() {
      return this._coordinateSystems.slice();
    }, r.register = function(t, e) {
      Wl[t] = e;
    }, r.get = function(t) {
      return Wl[t];
    }, r;
  })()
), Bx = /^(min|max)?(.+)$/, zx = (
  /** @class */
  (function() {
    function r(t) {
      this._timelineOptions = [], this._mediaList = [], this._currentMediaIndices = [], this._api = t;
    }
    return r.prototype.setOption = function(t, e, i) {
      t && (T(Dt(t.series), function(o) {
        o && o.data && Gt(o.data) && Wo(o.data);
      }), T(Dt(t.dataset), function(o) {
        o && o.source && Gt(o.source) && Wo(o.source);
      })), t = U(t);
      var n = this._optionBackup, a = Fx(t, e, !n);
      this._newBaseOption = a.baseOption, n ? (a.timelineOptions.length && (n.timelineOptions = a.timelineOptions), a.mediaList.length && (n.mediaList = a.mediaList), a.mediaDefault && (n.mediaDefault = a.mediaDefault)) : this._optionBackup = a;
    }, r.prototype.mountOption = function(t) {
      var e = this._optionBackup;
      return this._timelineOptions = e.timelineOptions, this._mediaList = e.mediaList, this._mediaDefault = e.mediaDefault, this._currentMediaIndices = [], U(t ? e.baseOption : this._newBaseOption);
    }, r.prototype.getTimelineOption = function(t) {
      var e, i = this._timelineOptions;
      if (i.length) {
        var n = t.getComponent("timeline");
        n && (e = U(
          // FIXME:TS as TimelineModel or quivlant interface
          i[n.getCurrentIndex()]
        ));
      }
      return e;
    }, r.prototype.getMediaOption = function(t) {
      var e = this._api.getWidth(), i = this._api.getHeight(), n = this._mediaList, a = this._mediaDefault, o = [], s = [];
      if (!n.length && !a)
        return s;
      for (var l = 0, u = n.length; l < u; l++)
        Vx(n[l].query, e, i) && o.push(l);
      return !o.length && a && (o = [-1]), o.length && !Gx(o, this._currentMediaIndices) && (s = z(o, function(f) {
        return U(f === -1 ? a.option : n[f].option);
      })), this._currentMediaIndices = o, s;
    }, r;
  })()
);
function Fx(r, t, e) {
  var i = [], n, a, o = r.baseOption, s = r.timeline, l = r.options, u = r.media, f = !!r.media, h = !!(l || s || o && o.timeline);
  o ? (a = o, a.timeline || (a.timeline = s)) : ((h || f) && (r.options = r.media = null), a = r), f && O(u) && T(u, function(v) {
    v && v.option && (v.query ? i.push(v) : n || (n = v));
  }), c(a), T(l, function(v) {
    return c(v);
  }), T(i, function(v) {
    return c(v.option);
  });
  function c(v) {
    T(t, function(p) {
      p(v, e);
    });
  }
  return {
    baseOption: a,
    timelineOptions: l || [],
    mediaDefault: n,
    mediaList: i
  };
}
function Vx(r, t, e) {
  var i = {
    width: t,
    height: e,
    aspectratio: t / e
    // lower case for convenience.
  }, n = !0;
  return T(r, function(a, o) {
    var s = o.match(Bx);
    if (!(!s || !s[1] || !s[2])) {
      var l = s[1], u = s[2].toLowerCase();
      Hx(i[u], a, l) || (n = !1);
    }
  }), n;
}
function Hx(r, t, e) {
  return e === "min" ? r >= t : e === "max" ? r <= t : r === t;
}
function Gx(r, t) {
  return r.join(",") === t.join(",");
}
var be = T, va = H, Vc = ["areaStyle", "lineStyle", "nodeStyle", "linkStyle", "chordStyle", "label", "labelLine"];
function Ul(r) {
  var t = r && r.itemStyle;
  if (t)
    for (var e = 0, i = Vc.length; e < i; e++) {
      var n = Vc[e], a = t.normal, o = t.emphasis;
      a && a[n] && (r[n] = r[n] || {}, r[n].normal ? j(r[n].normal, a[n]) : r[n].normal = a[n], a[n] = null), o && o[n] && (r[n] = r[n] || {}, r[n].emphasis ? j(r[n].emphasis, o[n]) : r[n].emphasis = o[n], o[n] = null);
    }
}
function Pt(r, t, e) {
  if (r && r[t] && (r[t].normal || r[t].emphasis)) {
    var i = r[t].normal, n = r[t].emphasis;
    i && (e ? (r[t].normal = r[t].emphasis = null, at(r[t], i)) : r[t] = i), n && (r.emphasis = r.emphasis || {}, r.emphasis[t] = n, n.focus && (r.emphasis.focus = n.focus), n.blurScope && (r.emphasis.blurScope = n.blurScope));
  }
}
function Nn(r) {
  Pt(r, "itemStyle"), Pt(r, "lineStyle"), Pt(r, "areaStyle"), Pt(r, "label"), Pt(r, "labelLine"), Pt(r, "upperLabel"), Pt(r, "edgeLabel");
}
function wt(r, t) {
  var e = va(r) && r[t], i = va(e) && e.textStyle;
  if (i)
    for (var n = 0, a = Hv.length; n < a; n++) {
      var o = Hv[n];
      i.hasOwnProperty(o) && (e[o] = i[o]);
    }
}
function le(r) {
  r && (Nn(r), wt(r, "label"), r.emphasis && wt(r.emphasis, "label"));
}
function Wx(r) {
  if (va(r)) {
    Ul(r), Nn(r), wt(r, "label"), wt(r, "upperLabel"), wt(r, "edgeLabel"), r.emphasis && (wt(r.emphasis, "label"), wt(r.emphasis, "upperLabel"), wt(r.emphasis, "edgeLabel"));
    var t = r.markPoint;
    t && (Ul(t), le(t));
    var e = r.markLine;
    e && (Ul(e), le(e));
    var i = r.markArea;
    i && le(i);
    var n = r.data;
    if (r.type === "graph") {
      n = n || r.nodes;
      var a = r.links || r.edges;
      if (a && !Gt(a))
        for (var o = 0; o < a.length; o++)
          le(a[o]);
      T(r.categories, function(u) {
        Nn(u);
      });
    }
    if (n && !Gt(n))
      for (var o = 0; o < n.length; o++)
        le(n[o]);
    if (t = r.markPoint, t && t.data)
      for (var s = t.data, o = 0; o < s.length; o++)
        le(s[o]);
    if (e = r.markLine, e && e.data)
      for (var l = e.data, o = 0; o < l.length; o++)
        O(l[o]) ? (le(l[o][0]), le(l[o][1])) : le(l[o]);
    r.type === "gauge" ? (wt(r, "axisLabel"), wt(r, "title"), wt(r, "detail")) : r.type === "treemap" ? (Pt(r.breadcrumb, "itemStyle"), T(r.levels, function(u) {
      Nn(u);
    })) : r.type === "tree" && Nn(r.leaves);
  }
}
function Qe(r) {
  return O(r) ? r : r ? [r] : [];
}
function Hc(r) {
  return (O(r) ? r[0] : r) || {};
}
function Ux(r, t) {
  be(Qe(r.series), function(i) {
    va(i) && Wx(i);
  });
  var e = ["xAxis", "yAxis", "radiusAxis", "angleAxis", "singleAxis", "parallelAxis", "radar"];
  t && e.push("valueAxis", "categoryAxis", "logAxis", "timeAxis"), be(e, function(i) {
    be(Qe(r[i]), function(n) {
      n && (wt(n, "axisLabel"), wt(n.axisPointer, "label"));
    });
  }), be(Qe(r.parallel), function(i) {
    var n = i && i.parallelAxisDefault;
    wt(n, "axisLabel"), wt(n && n.axisPointer, "label");
  }), be(Qe(r.calendar), function(i) {
    Pt(i, "itemStyle"), wt(i, "dayLabel"), wt(i, "monthLabel"), wt(i, "yearLabel");
  }), be(Qe(r.radar), function(i) {
    wt(i, "name"), i.name && i.axisName == null && (i.axisName = i.name, delete i.name), i.nameGap != null && i.axisNameGap == null && (i.axisNameGap = i.nameGap, delete i.nameGap);
  }), be(Qe(r.geo), function(i) {
    va(i) && (le(i), be(Qe(i.regions), function(n) {
      le(n);
    }));
  }), be(Qe(r.timeline), function(i) {
    le(i), Pt(i, "label"), Pt(i, "itemStyle"), Pt(i, "controlStyle", !0);
    var n = i.data;
    O(n) && T(n, function(a) {
      H(a) && (Pt(a, "label"), Pt(a, "itemStyle"));
    });
  }), be(Qe(r.toolbox), function(i) {
    Pt(i, "iconStyle"), be(i.feature, function(n) {
      Pt(n, "iconStyle");
    });
  }), wt(Hc(r.axisPointer), "label"), wt(Hc(r.tooltip).axisPointer, "label");
}
function Yx(r, t) {
  for (var e = t.split(","), i = r, n = 0; n < e.length && (i = i && i[e[n]], i != null); n++)
    ;
  return i;
}
function Xx(r, t, e, i) {
  for (var n = t.split(","), a = r, o, s = 0; s < n.length - 1; s++)
    o = n[s], a[o] == null && (a[o] = {}), a = a[o];
  a[n[s]] == null && (a[n[s]] = e);
}
function Gc(r) {
  r && T($x, function(t) {
    t[0] in r && !(t[1] in r) && (r[t[1]] = r[t[0]]);
  });
}
var $x = [["x", "left"], ["y", "top"], ["x2", "right"], ["y2", "bottom"]], Zx = ["grid", "geo", "parallel", "legend", "toolbox", "title", "visualMap", "dataZoom", "timeline"], Yl = [["borderRadius", "barBorderRadius"], ["borderColor", "barBorderColor"], ["borderWidth", "barBorderWidth"]];
function _n(r) {
  var t = r && r.itemStyle;
  if (t)
    for (var e = 0; e < Yl.length; e++) {
      var i = Yl[e][1], n = Yl[e][0];
      t[i] != null && (t[n] = t[i]);
    }
}
function Wc(r) {
  r && r.alignTo === "edge" && r.margin != null && r.edgeDistance == null && (r.edgeDistance = r.margin);
}
function Uc(r) {
  r && r.downplay && !r.blur && (r.blur = r.downplay);
}
function qx(r) {
  r && r.focusNodeAdjacency != null && (r.emphasis = r.emphasis || {}, r.emphasis.focus == null && (r.emphasis.focus = "adjacency"));
}
function vm(r, t) {
  if (r)
    for (var e = 0; e < r.length; e++)
      t(r[e]), r[e] && vm(r[e].children, t);
}
function cm(r, t) {
  Ux(r, t), r.series = Dt(r.series), T(r.series, function(e) {
    if (H(e)) {
      var i = e.type;
      if (i === "line")
        e.clipOverflow != null && (e.clip = e.clipOverflow);
      else if (i === "pie" || i === "gauge") {
        e.clockWise != null && (e.clockwise = e.clockWise), Wc(e.label);
        var n = e.data;
        if (n && !Gt(n))
          for (var a = 0; a < n.length; a++)
            Wc(n[a]);
        e.hoverOffset != null && (e.emphasis = e.emphasis || {}, (e.emphasis.scaleSize = null) && (e.emphasis.scaleSize = e.hoverOffset));
      } else if (i === "gauge") {
        var o = Yx(e, "pointer.color");
        o != null && Xx(e, "itemStyle.color", o);
      } else if (i === "bar") {
        _n(e), _n(e.backgroundStyle), _n(e.emphasis);
        var n = e.data;
        if (n && !Gt(n))
          for (var a = 0; a < n.length; a++)
            typeof n[a] == "object" && (_n(n[a]), _n(n[a] && n[a].emphasis));
      } else if (i === "sunburst") {
        var s = e.highlightPolicy;
        s && (e.emphasis = e.emphasis || {}, e.emphasis.focus || (e.emphasis.focus = s)), Uc(e), vm(e.data, Uc);
      } else i === "graph" || i === "sankey" ? qx(e) : i === "map" && (e.mapType && !e.map && (e.map = e.mapType), e.mapLocation && at(e, e.mapLocation));
      e.hoverAnimation != null && (e.emphasis = e.emphasis || {}, e.emphasis && e.emphasis.scale == null && (e.emphasis.scale = e.hoverAnimation)), Gc(e);
    }
  }), r.dataRange && (r.visualMap = r.dataRange), T(Zx, function(e) {
    var i = r[e];
    i && (O(i) || (i = [i]), T(i, function(n) {
      Gc(n);
    }));
  });
}
function Kx(r) {
  var t = q();
  r.eachSeries(function(e) {
    var i = e.get("stack");
    if (i) {
      var n = t.get(i) || t.set(i, []), a = e.getData(), o = {
        // Used for calculate axis extent automatically.
        // TODO: Type getCalculationInfo return more specific type?
        stackResultDimension: a.getCalculationInfo("stackResultDimension"),
        stackedOverDimension: a.getCalculationInfo("stackedOverDimension"),
        stackedDimension: a.getCalculationInfo("stackedDimension"),
        stackedByDimension: a.getCalculationInfo("stackedByDimension"),
        isStackedByIndex: a.getCalculationInfo("isStackedByIndex"),
        data: a,
        seriesModel: e
      };
      if (!o.stackedDimension || !(o.isStackedByIndex || o.stackedByDimension))
        return;
      n.length && a.setCalculationInfo("stackedOnSeries", n[n.length - 1].seriesModel), n.push(o);
    }
  }), t.each(Qx);
}
function Qx(r) {
  T(r, function(t, e) {
    var i = [], n = [NaN, NaN], a = [t.stackResultDimension, t.stackedOverDimension], o = t.data, s = t.isStackedByIndex, l = t.seriesModel.get("stackStrategy") || "samesign";
    o.modify(a, function(u, f, h) {
      var c = o.get(t.stackedDimension, h);
      if (isNaN(c))
        return n;
      var v, p;
      s ? p = o.getRawIndex(h) : v = o.get(t.stackedByDimension, h);
      for (var g = NaN, d = e - 1; d >= 0; d--) {
        var y = r[d];
        if (s || (p = y.data.rawIndexOf(y.stackedByDimension, v)), p >= 0) {
          var m = y.data.getByRawIndex(y.stackResultDimension, p);
          if (l === "all" || l === "positive" && m > 0 || l === "negative" && m < 0 || l === "samesign" && c >= 0 && m > 0 || l === "samesign" && c <= 0 && m < 0) {
            c = DS(c, m), g = m;
            break;
          }
        }
      }
      return i[0] = c, i[1] = g, i;
    });
  });
}
var $s = (
  /** @class */
  /* @__PURE__ */ (function() {
    function r(t) {
      this.data = t.data || (t.sourceFormat === nr ? {} : []), this.sourceFormat = t.sourceFormat || sm, this.seriesLayoutBy = t.seriesLayoutBy || rr, this.startIndex = t.startIndex || 0, this.dimensionsDetectedCount = t.dimensionsDetectedCount, this.metaRawOption = t.metaRawOption;
      var e = this.dimensionsDefine = t.dimensionsDefine;
      if (e)
        for (var i = 0; i < e.length; i++) {
          var n = e[i];
          n.type == null && fm(this, i) === jt.Must && (n.type = "ordinal");
        }
    }
    return r;
  })()
);
function kh(r) {
  return r instanceof $s;
}
function cf(r, t, e) {
  e = e || dm(r);
  var i = t.seriesLayoutBy, n = jx(r, e, i, t.sourceHeader, t.dimensions), a = new $s({
    data: r,
    sourceFormat: e,
    seriesLayoutBy: i,
    dimensionsDefine: n.dimensionsDefine,
    startIndex: n.startIndex,
    dimensionsDetectedCount: n.dimensionsDetectedCount,
    metaRawOption: U(t)
  });
  return a;
}
function pm(r) {
  return new $s({
    data: r,
    sourceFormat: Gt(r) ? xr : _e
  });
}
function Jx(r) {
  return new $s({
    data: r.data,
    sourceFormat: r.sourceFormat,
    seriesLayoutBy: r.seriesLayoutBy,
    dimensionsDefine: U(r.dimensionsDefine),
    startIndex: r.startIndex,
    dimensionsDetectedCount: r.dimensionsDetectedCount
  });
}
function dm(r) {
  var t = sm;
  if (Gt(r))
    t = xr;
  else if (O(r)) {
    r.length === 0 && (t = Qt);
    for (var e = 0, i = r.length; e < i; e++) {
      var n = r[e];
      if (n != null) {
        if (O(n) || Gt(n)) {
          t = Qt;
          break;
        } else if (H(n)) {
          t = Ze;
          break;
        }
      }
    }
  } else if (H(r)) {
    for (var a in r)
      if (Mr(r, a) && Ht(r[a])) {
        t = nr;
        break;
      }
  }
  return t;
}
function jx(r, t, e, i, n) {
  var a, o;
  if (!r)
    return {
      dimensionsDefine: Yc(n),
      startIndex: o,
      dimensionsDetectedCount: a
    };
  if (t === Qt) {
    var s = r;
    i === "auto" || i == null ? Xc(function(u) {
      u != null && u !== "-" && (V(u) ? o == null && (o = 1) : o = 0);
    }, e, s, 10) : o = vt(i) ? i : i ? 1 : 0, !n && o === 1 && (n = [], Xc(function(u, f) {
      n[f] = u != null ? u + "" : "";
    }, e, s, 1 / 0)), a = n ? n.length : e === on ? s.length : s[0] ? s[0].length : null;
  } else if (t === Ze)
    n || (n = tT(r));
  else if (t === nr)
    n || (n = [], T(r, function(u, f) {
      n.push(f);
    }));
  else if (t === _e) {
    var l = Ta(r[0]);
    a = O(l) && l.length || 1;
  }
  return {
    startIndex: o,
    dimensionsDefine: Yc(n),
    dimensionsDetectedCount: a
  };
}
function tT(r) {
  for (var t = 0, e; t < r.length && !(e = r[t++]); )
    ;
  if (e)
    return ct(e);
}
function Yc(r) {
  if (r) {
    var t = q();
    return z(r, function(e, i) {
      e = H(e) ? e : {
        name: e
      };
      var n = {
        name: e.name,
        displayName: e.displayName,
        type: e.type
      };
      if (n.name == null)
        return n;
      n.name += "", n.displayName == null && (n.displayName = n.name);
      var a = t.get(n.name);
      return a ? n.name += "-" + a.count++ : t.set(n.name, {
        count: 1
      }), n;
    });
  }
}
function Xc(r, t, e, i) {
  if (t === on)
    for (var n = 0; n < e.length && n < i; n++)
      r(e[n] ? e[n][0] : null, n);
  else
    for (var a = e[0] || [], n = 0; n < a.length && n < i; n++)
      r(a[n], n);
}
function gm(r) {
  var t = r.sourceFormat;
  return t === Ze || t === nr;
}
var qr, Kr, Qr, $c, Zc, ym = (
  /** @class */
  (function() {
    function r(t, e) {
      var i = kh(t) ? t : pm(t);
      this._source = i;
      var n = this._data = i.data;
      i.sourceFormat === xr && (this._offset = 0, this._dimSize = e, this._data = n), Zc(this, n, i);
    }
    return r.prototype.getSource = function() {
      return this._source;
    }, r.prototype.count = function() {
      return 0;
    }, r.prototype.getItem = function(t, e) {
    }, r.prototype.appendData = function(t) {
    }, r.prototype.clean = function() {
    }, r.protoInitialize = (function() {
      var t = r.prototype;
      t.pure = !1, t.persistent = !0;
    })(), r.internalField = (function() {
      var t;
      Zc = function(o, s, l) {
        var u = l.sourceFormat, f = l.seriesLayoutBy, h = l.startIndex, c = l.dimensionsDefine, v = $c[Nh(u, f)];
        if (k(o, v), u === xr)
          o.getItem = e, o.count = n, o.fillStorage = i;
        else {
          var p = mm(u, f);
          o.getItem = Q(p, null, s, h, c);
          var g = _m(u, f);
          o.count = Q(g, null, s, h, c);
        }
      };
      var e = function(o, s) {
        o = o - this._offset, s = s || [];
        for (var l = this._data, u = this._dimSize, f = u * o, h = 0; h < u; h++)
          s[h] = l[f + h];
        return s;
      }, i = function(o, s, l, u) {
        for (var f = this._data, h = this._dimSize, c = 0; c < h; c++) {
          for (var v = u[c], p = v[0] == null ? 1 / 0 : v[0], g = v[1] == null ? -1 / 0 : v[1], d = s - o, y = l[c], m = 0; m < d; m++) {
            var _ = f[m * h + c];
            y[o + m] = _, _ < p && (p = _), _ > g && (g = _);
          }
          v[0] = p, v[1] = g;
        }
      }, n = function() {
        return this._data ? this._data.length / this._dimSize : 0;
      };
      $c = (t = {}, t[Qt + "_" + rr] = {
        pure: !0,
        appendData: a
      }, t[Qt + "_" + on] = {
        pure: !0,
        appendData: function() {
          throw new Error('Do not support appendData when set seriesLayoutBy: "row".');
        }
      }, t[Ze] = {
        pure: !0,
        appendData: a
      }, t[nr] = {
        pure: !0,
        appendData: function(o) {
          var s = this._data;
          T(o, function(l, u) {
            for (var f = s[u] || (s[u] = []), h = 0; h < (l || []).length; h++)
              f.push(l[h]);
          });
        }
      }, t[_e] = {
        appendData: a
      }, t[xr] = {
        persistent: !1,
        pure: !0,
        appendData: function(o) {
          this._data = o;
        },
        // Clean self if data is already used.
        clean: function() {
          this._offset += this.count(), this._data = null;
        }
      }, t);
      function a(o) {
        for (var s = 0; s < o.length; s++)
          this._data.push(o[s]);
      }
    })(), r;
  })()
), qc = function(r, t, e, i) {
  return r[i];
}, eT = (qr = {}, qr[Qt + "_" + rr] = function(r, t, e, i) {
  return r[i + t];
}, qr[Qt + "_" + on] = function(r, t, e, i, n) {
  i += t;
  for (var a = n || [], o = r, s = 0; s < o.length; s++) {
    var l = o[s];
    a[s] = l ? l[i] : null;
  }
  return a;
}, qr[Ze] = qc, qr[nr] = function(r, t, e, i, n) {
  for (var a = n || [], o = 0; o < e.length; o++) {
    var s = e[o].name, l = r[s];
    a[o] = l ? l[i] : null;
  }
  return a;
}, qr[_e] = qc, qr);
function mm(r, t) {
  var e = eT[Nh(r, t)];
  return e;
}
var Kc = function(r, t, e) {
  return r.length;
}, rT = (Kr = {}, Kr[Qt + "_" + rr] = function(r, t, e) {
  return Math.max(0, r.length - t);
}, Kr[Qt + "_" + on] = function(r, t, e) {
  var i = r[0];
  return i ? Math.max(0, i.length - t) : 0;
}, Kr[Ze] = Kc, Kr[nr] = function(r, t, e) {
  var i = e[0].name, n = r[i];
  return n ? n.length : 0;
}, Kr[_e] = Kc, Kr);
function _m(r, t) {
  var e = rT[Nh(r, t)];
  return e;
}
var Xl = function(r, t, e) {
  return r[t];
}, iT = (Qr = {}, Qr[Qt] = Xl, Qr[Ze] = function(r, t, e) {
  return r[e];
}, Qr[nr] = Xl, Qr[_e] = function(r, t, e) {
  var i = Ta(r);
  return i instanceof Array ? i[t] : i;
}, Qr[xr] = Xl, Qr);
function Sm(r) {
  var t = iT[r];
  return t;
}
function Nh(r, t) {
  return r === Qt ? r + "_" + t : r;
}
function tn(r, t, e) {
  if (r) {
    var i = r.getRawDataItem(t);
    if (i != null) {
      var n = r.getStore(), a = n.getSource().sourceFormat;
      if (e != null) {
        var o = r.getDimensionIndex(e), s = n.getDimensionProperty(o);
        return Sm(a)(i, o, s);
      } else {
        var l = i;
        return a === _e && (l = Ta(i)), l;
      }
    }
  }
}
var nT = /\{@(.+?)\}/g, Bh = (
  /** @class */
  (function() {
    function r() {
    }
    return r.prototype.getDataParams = function(t, e) {
      var i = this.getData(e), n = this.getRawValue(t, e), a = i.getRawIndex(t), o = i.getName(t), s = i.getRawDataItem(t), l = i.getItemVisual(t, "style"), u = l && l[i.getItemVisual(t, "drawType") || "fill"], f = l && l.stroke, h = this.mainType, c = h === "series", v = i.userOutput && i.userOutput.get();
      return {
        componentType: h,
        componentSubType: this.subType,
        componentIndex: this.componentIndex,
        seriesType: c ? this.subType : null,
        seriesIndex: this.seriesIndex,
        seriesId: c ? this.id : null,
        seriesName: c ? this.name : null,
        name: o,
        dataIndex: a,
        data: s,
        dataType: e,
        value: n,
        color: u,
        borderColor: f,
        dimensionNames: v ? v.fullDimensions : null,
        encode: v ? v.encode : null,
        // Param name list for mapping `a`, `b`, `c`, `d`, `e`
        $vars: ["seriesName", "name", "value"]
      };
    }, r.prototype.getFormattedLabel = function(t, e, i, n, a, o) {
      e = e || "normal";
      var s = this.getData(i), l = this.getDataParams(t, i);
      if (o && (l.value = o.interpolatedValue), n != null && O(l.value) && (l.value = l.value[n]), !a) {
        var u = s.getItemModel(t);
        a = u.get(e === "normal" ? ["label", "formatter"] : [e, "label", "formatter"]);
      }
      if (X(a))
        return l.status = e, l.dimensionIndex = n, a(l);
      if (V(a)) {
        var f = Ph(a, l);
        return f.replace(nT, function(h, c) {
          var v = c.length, p = c;
          p.charAt(0) === "[" && p.charAt(v - 1) === "]" && (p = +p.slice(1, v - 1));
          var g = tn(s, t, p);
          if (o && O(o.interpolatedValue)) {
            var d = s.getDimensionIndex(p);
            d >= 0 && (g = o.interpolatedValue[d]);
          }
          return g != null ? g + "" : "";
        });
      }
    }, r.prototype.getRawValue = function(t, e) {
      return tn(this.getData(e), t);
    }, r.prototype.formatTooltip = function(t, e, i) {
    }, r;
  })()
);
function Qc(r) {
  var t, e;
  return H(r) ? r.type && (e = r) : t = r, {
    text: t,
    // markers: markers || markersExisting,
    frag: e
  };
}
function Zn(r) {
  return new aT(r);
}
var aT = (
  /** @class */
  (function() {
    function r(t) {
      t = t || {}, this._reset = t.reset, this._plan = t.plan, this._count = t.count, this._onDirty = t.onDirty, this._dirty = !0;
    }
    return r.prototype.perform = function(t) {
      var e = this._upstream, i = t && t.skip;
      if (this._dirty && e) {
        var n = this.context;
        n.data = n.outputData = e.context.outputData;
      }
      this.__pipeline && (this.__pipeline.currentTask = this);
      var a;
      this._plan && !i && (a = this._plan(this.context));
      var o = f(this._modBy), s = this._modDataCount || 0, l = f(t && t.modBy), u = t && t.modDataCount || 0;
      (o !== l || s !== u) && (a = "reset");
      function f(m) {
        return !(m >= 1) && (m = 1), m;
      }
      var h;
      (this._dirty || a === "reset") && (this._dirty = !1, h = this._doReset(i)), this._modBy = l, this._modDataCount = u;
      var c = t && t.step;
      if (e ? this._dueEnd = e._outputDueEnd : this._dueEnd = this._count ? this._count(this.context) : 1 / 0, this._progress) {
        var v = this._dueIndex, p = Math.min(c != null ? this._dueIndex + c : 1 / 0, this._dueEnd);
        if (!i && (h || v < p)) {
          var g = this._progress;
          if (O(g))
            for (var d = 0; d < g.length; d++)
              this._doProgress(g[d], v, p, l, u);
          else
            this._doProgress(g, v, p, l, u);
        }
        this._dueIndex = p;
        var y = this._settedOutputEnd != null ? this._settedOutputEnd : p;
        this._outputDueEnd = y;
      } else
        this._dueIndex = this._outputDueEnd = this._settedOutputEnd != null ? this._settedOutputEnd : this._dueEnd;
      return this.unfinished();
    }, r.prototype.dirty = function() {
      this._dirty = !0, this._onDirty && this._onDirty(this.context);
    }, r.prototype._doProgress = function(t, e, i, n, a) {
      Jc.reset(e, i, n, a), this._callingProgress = t, this._callingProgress({
        start: e,
        end: i,
        count: i - e,
        next: Jc.next
      }, this.context);
    }, r.prototype._doReset = function(t) {
      this._dueIndex = this._outputDueEnd = this._dueEnd = 0, this._settedOutputEnd = null;
      var e, i;
      !t && this._reset && (e = this._reset(this.context), e && e.progress && (i = e.forceFirstProgress, e = e.progress), O(e) && !e.length && (e = null)), this._progress = e, this._modBy = this._modDataCount = null;
      var n = this._downstream;
      return n && n.dirty(), i;
    }, r.prototype.unfinished = function() {
      return this._progress && this._dueIndex < this._dueEnd;
    }, r.prototype.pipe = function(t) {
      (this._downstream !== t || this._dirty) && (this._downstream = t, t._upstream = this, t.dirty());
    }, r.prototype.dispose = function() {
      this._disposed || (this._upstream && (this._upstream._downstream = null), this._downstream && (this._downstream._upstream = null), this._dirty = !1, this._disposed = !0);
    }, r.prototype.getUpstream = function() {
      return this._upstream;
    }, r.prototype.getDownstream = function() {
      return this._downstream;
    }, r.prototype.setOutputEnd = function(t) {
      this._outputDueEnd = this._settedOutputEnd = t;
    }, r;
  })()
), Jc = /* @__PURE__ */ (function() {
  var r, t, e, i, n, a = {
    reset: function(l, u, f, h) {
      t = l, r = u, e = f, i = h, n = Math.ceil(i / e), a.next = e > 1 && i > 0 ? s : o;
    }
  };
  return a;
  function o() {
    return t < r ? t++ : null;
  }
  function s() {
    var l = t % n * e + Math.ceil(t / n), u = t >= r ? null : l < i ? l : t;
    return t++, u;
  }
})();
function Ki(r, t) {
  var e = t && t.type;
  return e === "ordinal" ? r : (e === "time" && !vt(r) && r != null && r !== "-" && (r = +pe(r)), r == null || r === "" ? NaN : Number(r));
}
q({
  number: function(r) {
    return parseFloat(r);
  },
  time: function(r) {
    return +pe(r);
  },
  trim: function(r) {
    return V(r) ? Me(r) : r;
  }
});
var oT = (
  /** @class */
  (function() {
    function r(t, e) {
      var i = t === "desc";
      this._resultLT = i ? 1 : -1, e == null && (e = i ? "min" : "max"), this._incomparable = e === "min" ? -1 / 0 : 1 / 0;
    }
    return r.prototype.evaluate = function(t, e) {
      var i = vt(t) ? t : na(t), n = vt(e) ? e : na(e), a = isNaN(i), o = isNaN(n);
      if (a && (i = this._incomparable), o && (n = this._incomparable), a && o) {
        var s = V(t), l = V(e);
        s && (i = l ? t : 0), l && (n = s ? e : 0);
      }
      return i < n ? this._resultLT : i > n ? -this._resultLT : 0;
    }, r;
  })()
), sT = (
  /** @class */
  (function() {
    function r() {
    }
    return r.prototype.getRawData = function() {
      throw new Error("not supported");
    }, r.prototype.getRawDataItem = function(t) {
      throw new Error("not supported");
    }, r.prototype.cloneRawData = function() {
    }, r.prototype.getDimensionInfo = function(t) {
    }, r.prototype.cloneAllDimensionInfo = function() {
    }, r.prototype.count = function() {
    }, r.prototype.retrieveValue = function(t, e) {
    }, r.prototype.retrieveValueFromItem = function(t, e) {
    }, r.prototype.convertValue = function(t, e) {
      return Ki(t, e);
    }, r;
  })()
);
function lT(r, t) {
  var e = new sT(), i = r.data, n = e.sourceFormat = r.sourceFormat, a = r.startIndex, o = "";
  r.seriesLayoutBy !== rr && Zt(o);
  var s = [], l = {}, u = r.dimensionsDefine;
  if (u)
    T(u, function(g, d) {
      var y = g.name, m = {
        index: d,
        name: y,
        displayName: g.displayName
      };
      if (s.push(m), y != null) {
        var _ = "";
        Mr(l, y) && Zt(_), l[y] = m;
      }
    });
  else
    for (var f = 0; f < r.dimensionsDetectedCount; f++)
      s.push({
        index: f
      });
  var h = mm(n, rr);
  t.__isBuiltIn && (e.getRawDataItem = function(g) {
    return h(i, a, s, g);
  }, e.getRawData = Q(uT, null, r)), e.cloneRawData = Q(fT, null, r);
  var c = _m(n, rr);
  e.count = Q(c, null, i, a, s);
  var v = Sm(n);
  e.retrieveValue = function(g, d) {
    var y = h(i, a, s, g);
    return p(y, d);
  };
  var p = e.retrieveValueFromItem = function(g, d) {
    if (g != null) {
      var y = s[d];
      if (y)
        return v(g, d, y.name);
    }
  };
  return e.getDimensionInfo = Q(hT, null, s, l), e.cloneAllDimensionInfo = Q(vT, null, s), e;
}
function uT(r) {
  var t = r.sourceFormat;
  if (!zh(t)) {
    var e = "";
    Zt(e);
  }
  return r.data;
}
function fT(r) {
  var t = r.sourceFormat, e = r.data;
  if (!zh(t)) {
    var i = "";
    Zt(i);
  }
  if (t === Qt) {
    for (var n = [], a = 0, o = e.length; a < o; a++)
      n.push(e[a].slice());
    return n;
  } else if (t === Ze) {
    for (var n = [], a = 0, o = e.length; a < o; a++)
      n.push(k({}, e[a]));
    return n;
  }
}
function hT(r, t, e) {
  if (e != null) {
    if (vt(e) || !isNaN(e) && !Mr(t, e))
      return r[e];
    if (Mr(t, e))
      return t[e];
  }
}
function vT(r) {
  return U(r);
}
var bm = q();
function cT(r) {
  r = U(r);
  var t = r.type, e = "";
  t || Zt(e);
  var i = t.split(":");
  i.length !== 2 && Zt(e);
  var n = !1;
  i[0] === "echarts" && (t = i[1], n = !0), r.__isBuiltIn = n, bm.set(t, r);
}
function pT(r, t, e) {
  var i = Dt(r), n = i.length, a = "";
  n || Zt(a);
  for (var o = 0, s = n; o < s; o++) {
    var l = i[o];
    t = dT(l, t), o !== s - 1 && (t.length = Math.max(t.length, 1));
  }
  return t;
}
function dT(r, t, e, i) {
  var n = "";
  t.length || Zt(n), H(r) || Zt(n);
  var a = r.type, o = bm.get(a);
  o || Zt(n);
  var s = z(t, function(u) {
    return lT(u, o);
  }), l = Dt(o.transform({
    upstream: s[0],
    upstreamList: s,
    config: U(r.config)
  }));
  return z(l, function(u, f) {
    var h = "";
    H(u) || Zt(h), u.data || Zt(h);
    var c = dm(u.data);
    zh(c) || Zt(h);
    var v, p = t[0];
    if (p && f === 0 && !u.dimensions) {
      var g = p.startIndex;
      g && (u.data = p.data.slice(0, g).concat(u.data)), v = {
        seriesLayoutBy: rr,
        sourceHeader: g,
        dimensions: p.metaRawOption.dimensions
      };
    } else
      v = {
        seriesLayoutBy: rr,
        sourceHeader: 0,
        dimensions: u.dimensions
      };
    return cf(u.data, v, null);
  });
}
function zh(r) {
  return r === Qt || r === Ze;
}
var Zs = "undefined", gT = typeof Uint32Array === Zs ? Array : Uint32Array, yT = typeof Uint16Array === Zs ? Array : Uint16Array, wm = typeof Int32Array === Zs ? Array : Int32Array, jc = typeof Float64Array === Zs ? Array : Float64Array, xm = {
  float: jc,
  int: wm,
  // Ordinal data type can be string or int
  ordinal: Array,
  number: Array,
  time: jc
}, $l;
function Li(r) {
  return r > 65535 ? gT : yT;
}
function Pi() {
  return [1 / 0, -1 / 0];
}
function mT(r) {
  var t = r.constructor;
  return t === Array ? r.slice() : new t(r);
}
function tp(r, t, e, i, n) {
  var a = xm[e || "float"];
  if (n) {
    var o = r[t], s = o && o.length;
    if (s !== i) {
      for (var l = new a(i), u = 0; u < s; u++)
        l[u] = o[u];
      r[t] = l;
    }
  } else
    r[t] = new a(i);
}
var pf = (
  /** @class */
  (function() {
    function r() {
      this._chunks = [], this._rawExtent = [], this._extent = [], this._count = 0, this._rawCount = 0, this._calcDimNameToIdx = q();
    }
    return r.prototype.initData = function(t, e, i) {
      this._provider = t, this._chunks = [], this._indices = null, this.getRawIndex = this._getRawIdxIdentity;
      var n = t.getSource(), a = this.defaultDimValueGetter = $l[n.sourceFormat];
      this._dimValueGetter = i || a, this._rawExtent = [], gm(n), this._dimensions = z(e, function(o) {
        return {
          // Only pick these two props. Not leak other properties like orderMeta.
          type: o.type,
          property: o.property
        };
      }), this._initDataFromProvider(0, t.count());
    }, r.prototype.getProvider = function() {
      return this._provider;
    }, r.prototype.getSource = function() {
      return this._provider.getSource();
    }, r.prototype.ensureCalculationDimension = function(t, e) {
      var i = this._calcDimNameToIdx, n = this._dimensions, a = i.get(t);
      if (a != null) {
        if (n[a].type === e)
          return a;
      } else
        a = n.length;
      return n[a] = {
        type: e
      }, i.set(t, a), this._chunks[a] = new xm[e || "float"](this._rawCount), this._rawExtent[a] = Pi(), a;
    }, r.prototype.collectOrdinalMeta = function(t, e) {
      var i = this._chunks[t], n = this._dimensions[t], a = this._rawExtent, o = n.ordinalOffset || 0, s = i.length;
      o === 0 && (a[t] = Pi());
      for (var l = a[t], u = o; u < s; u++) {
        var f = i[u] = e.parseAndCollect(i[u]);
        isNaN(f) || (l[0] = Math.min(f, l[0]), l[1] = Math.max(f, l[1]));
      }
      n.ordinalMeta = e, n.ordinalOffset = s, n.type = "ordinal";
    }, r.prototype.getOrdinalMeta = function(t) {
      var e = this._dimensions[t], i = e.ordinalMeta;
      return i;
    }, r.prototype.getDimensionProperty = function(t) {
      var e = this._dimensions[t];
      return e && e.property;
    }, r.prototype.appendData = function(t) {
      var e = this._provider, i = this.count();
      e.appendData(t);
      var n = e.count();
      return e.persistent || (n += i), i < n && this._initDataFromProvider(i, n, !0), [i, n];
    }, r.prototype.appendValues = function(t, e) {
      for (var i = this._chunks, n = this._dimensions, a = n.length, o = this._rawExtent, s = this.count(), l = s + Math.max(t.length, e || 0), u = 0; u < a; u++) {
        var f = n[u];
        tp(i, u, f.type, l, !0);
      }
      for (var h = [], c = s; c < l; c++)
        for (var v = c - s, p = 0; p < a; p++) {
          var f = n[p], g = $l.arrayRows.call(this, t[v] || h, f.property, v, p);
          i[p][c] = g;
          var d = o[p];
          g < d[0] && (d[0] = g), g > d[1] && (d[1] = g);
        }
      return this._rawCount = this._count = l, {
        start: s,
        end: l
      };
    }, r.prototype._initDataFromProvider = function(t, e, i) {
      for (var n = this._provider, a = this._chunks, o = this._dimensions, s = o.length, l = this._rawExtent, u = z(o, function(m) {
        return m.property;
      }), f = 0; f < s; f++) {
        var h = o[f];
        l[f] || (l[f] = Pi()), tp(a, f, h.type, e, i);
      }
      if (n.fillStorage)
        n.fillStorage(t, e, a, l);
      else
        for (var c = [], v = t; v < e; v++) {
          c = n.getItem(v, c);
          for (var p = 0; p < s; p++) {
            var g = a[p], d = this._dimValueGetter(c, u[p], v, p);
            g[v] = d;
            var y = l[p];
            d < y[0] && (y[0] = d), d > y[1] && (y[1] = d);
          }
        }
      !n.persistent && n.clean && n.clean(), this._rawCount = this._count = e, this._extent = [];
    }, r.prototype.count = function() {
      return this._count;
    }, r.prototype.get = function(t, e) {
      if (!(e >= 0 && e < this._count))
        return NaN;
      var i = this._chunks[t];
      return i ? i[this.getRawIndex(e)] : NaN;
    }, r.prototype.getValues = function(t, e) {
      var i = [], n = [];
      if (e == null) {
        e = t, t = [];
        for (var a = 0; a < this._dimensions.length; a++)
          n.push(a);
      } else
        n = t;
      for (var a = 0, o = n.length; a < o; a++)
        i.push(this.get(n[a], e));
      return i;
    }, r.prototype.getByRawIndex = function(t, e) {
      if (!(e >= 0 && e < this._rawCount))
        return NaN;
      var i = this._chunks[t];
      return i ? i[e] : NaN;
    }, r.prototype.getSum = function(t) {
      var e = this._chunks[t], i = 0;
      if (e)
        for (var n = 0, a = this.count(); n < a; n++) {
          var o = this.get(t, n);
          isNaN(o) || (i += o);
        }
      return i;
    }, r.prototype.getMedian = function(t) {
      var e = [];
      this.each([t], function(a) {
        isNaN(a) || e.push(a);
      });
      var i = e.sort(function(a, o) {
        return a - o;
      }), n = this.count();
      return n === 0 ? 0 : n % 2 === 1 ? i[(n - 1) / 2] : (i[n / 2] + i[n / 2 - 1]) / 2;
    }, r.prototype.indexOfRawIndex = function(t) {
      if (t >= this._rawCount || t < 0)
        return -1;
      if (!this._indices)
        return t;
      var e = this._indices, i = e[t];
      if (i != null && i < this._count && i === t)
        return t;
      for (var n = 0, a = this._count - 1; n <= a; ) {
        var o = (n + a) / 2 | 0;
        if (e[o] < t)
          n = o + 1;
        else if (e[o] > t)
          a = o - 1;
        else
          return o;
      }
      return -1;
    }, r.prototype.indicesOfNearest = function(t, e, i) {
      var n = this._chunks, a = n[t], o = [];
      if (!a)
        return o;
      i == null && (i = 1 / 0);
      for (var s = 1 / 0, l = -1, u = 0, f = 0, h = this.count(); f < h; f++) {
        var c = this.getRawIndex(f), v = e - a[c], p = Math.abs(v);
        p <= i && ((p < s || p === s && v >= 0 && l < 0) && (s = p, l = v, u = 0), v === l && (o[u++] = f));
      }
      return o.length = u, o;
    }, r.prototype.getIndices = function() {
      var t, e = this._indices;
      if (e) {
        var i = e.constructor, n = this._count;
        if (i === Array) {
          t = new i(n);
          for (var a = 0; a < n; a++)
            t[a] = e[a];
        } else
          t = new i(e.buffer, 0, n);
      } else {
        var i = Li(this._rawCount);
        t = new i(this.count());
        for (var a = 0; a < t.length; a++)
          t[a] = a;
      }
      return t;
    }, r.prototype.filter = function(t, e) {
      if (!this._count)
        return this;
      for (var i = this.clone(), n = i.count(), a = Li(i._rawCount), o = new a(n), s = [], l = t.length, u = 0, f = t[0], h = i._chunks, c = 0; c < n; c++) {
        var v = void 0, p = i.getRawIndex(c);
        if (l === 0)
          v = e(c);
        else if (l === 1) {
          var g = h[f][p];
          v = e(g, c);
        } else {
          for (var d = 0; d < l; d++)
            s[d] = h[t[d]][p];
          s[d] = c, v = e.apply(null, s);
        }
        v && (o[u++] = p);
      }
      return u < n && (i._indices = o), i._count = u, i._extent = [], i._updateGetRawIdx(), i;
    }, r.prototype.selectRange = function(t) {
      var e = this.clone(), i = e._count;
      if (!i)
        return this;
      var n = ct(t), a = n.length;
      if (!a)
        return this;
      var o = e.count(), s = Li(e._rawCount), l = new s(o), u = 0, f = n[0], h = t[f][0], c = t[f][1], v = e._chunks, p = !1;
      if (!e._indices) {
        var g = 0;
        if (a === 1) {
          for (var d = v[n[0]], y = 0; y < i; y++) {
            var m = d[y];
            (m >= h && m <= c || isNaN(m)) && (l[u++] = g), g++;
          }
          p = !0;
        } else if (a === 2) {
          for (var d = v[n[0]], _ = v[n[1]], S = t[n[1]][0], w = t[n[1]][1], y = 0; y < i; y++) {
            var m = d[y], b = _[y];
            (m >= h && m <= c || isNaN(m)) && (b >= S && b <= w || isNaN(b)) && (l[u++] = g), g++;
          }
          p = !0;
        }
      }
      if (!p)
        if (a === 1)
          for (var y = 0; y < o; y++) {
            var x = e.getRawIndex(y), m = v[n[0]][x];
            (m >= h && m <= c || isNaN(m)) && (l[u++] = x);
          }
        else
          for (var y = 0; y < o; y++) {
            for (var M = !0, x = e.getRawIndex(y), D = 0; D < a; D++) {
              var A = n[D], m = v[A][x];
              (m < t[A][0] || m > t[A][1]) && (M = !1);
            }
            M && (l[u++] = e.getRawIndex(y));
          }
      return u < o && (e._indices = l), e._count = u, e._extent = [], e._updateGetRawIdx(), e;
    }, r.prototype.map = function(t, e) {
      var i = this.clone(t);
      return this._updateDims(i, t, e), i;
    }, r.prototype.modify = function(t, e) {
      this._updateDims(this, t, e);
    }, r.prototype._updateDims = function(t, e, i) {
      for (var n = t._chunks, a = [], o = e.length, s = t.count(), l = [], u = t._rawExtent, f = 0; f < e.length; f++)
        u[e[f]] = Pi();
      for (var h = 0; h < s; h++) {
        for (var c = t.getRawIndex(h), v = 0; v < o; v++)
          l[v] = n[e[v]][c];
        l[o] = h;
        var p = i && i.apply(null, l);
        if (p != null) {
          typeof p != "object" && (a[0] = p, p = a);
          for (var f = 0; f < p.length; f++) {
            var g = e[f], d = p[f], y = u[g], m = n[g];
            m && (m[c] = d), d < y[0] && (y[0] = d), d > y[1] && (y[1] = d);
          }
        }
      }
    }, r.prototype.lttbDownSample = function(t, e) {
      var i = this.clone([t], !0), n = i._chunks, a = n[t], o = this.count(), s = 0, l = Math.floor(1 / e), u = this.getRawIndex(0), f, h, c, v = new (Li(this._rawCount))(Math.min((Math.ceil(o / l) + 2) * 2, o));
      v[s++] = u;
      for (var p = 1; p < o - 1; p += l) {
        for (var g = Math.min(p + l, o - 1), d = Math.min(p + l * 2, o), y = (d + g) / 2, m = 0, _ = g; _ < d; _++) {
          var S = this.getRawIndex(_), w = a[S];
          isNaN(w) || (m += w);
        }
        m /= d - g;
        var b = p, x = Math.min(p + l, o), M = p - 1, D = a[u];
        f = -1, c = b;
        for (var A = -1, C = 0, _ = b; _ < x; _++) {
          var S = this.getRawIndex(_), w = a[S];
          if (isNaN(w)) {
            C++, A < 0 && (A = S);
            continue;
          }
          h = Math.abs((M - y) * (w - D) - (M - _) * (m - D)), h > f && (f = h, c = S);
        }
        C > 0 && C < x - b && (v[s++] = Math.min(A, c), c = Math.max(A, c)), v[s++] = c, u = c;
      }
      return v[s++] = this.getRawIndex(o - 1), i._count = s, i._indices = v, i.getRawIndex = this._getRawIdx, i;
    }, r.prototype.minmaxDownSample = function(t, e) {
      for (var i = this.clone([t], !0), n = i._chunks, a = Math.floor(1 / e), o = n[t], s = this.count(), l = new (Li(this._rawCount))(Math.ceil(s / a) * 2), u = 0, f = 0; f < s; f += a) {
        var h = f, c = o[this.getRawIndex(h)], v = f, p = o[this.getRawIndex(v)], g = a;
        f + a > s && (g = s - f);
        for (var d = 0; d < g; d++) {
          var y = this.getRawIndex(f + d), m = o[y];
          m < c && (c = m, h = f + d), m > p && (p = m, v = f + d);
        }
        var _ = this.getRawIndex(h), S = this.getRawIndex(v);
        h < v ? (l[u++] = _, l[u++] = S) : (l[u++] = S, l[u++] = _);
      }
      return i._count = u, i._indices = l, i._updateGetRawIdx(), i;
    }, r.prototype.downSample = function(t, e, i, n) {
      for (var a = this.clone([t], !0), o = a._chunks, s = [], l = Math.floor(1 / e), u = o[t], f = this.count(), h = a._rawExtent[t] = Pi(), c = new (Li(this._rawCount))(Math.ceil(f / l)), v = 0, p = 0; p < f; p += l) {
        l > f - p && (l = f - p, s.length = l);
        for (var g = 0; g < l; g++) {
          var d = this.getRawIndex(p + g);
          s[g] = u[d];
        }
        var y = i(s), m = this.getRawIndex(Math.min(p + n(s, y) || 0, f - 1));
        u[m] = y, y < h[0] && (h[0] = y), y > h[1] && (h[1] = y), c[v++] = m;
      }
      return a._count = v, a._indices = c, a._updateGetRawIdx(), a;
    }, r.prototype.each = function(t, e) {
      if (this._count)
        for (var i = t.length, n = this._chunks, a = 0, o = this.count(); a < o; a++) {
          var s = this.getRawIndex(a);
          switch (i) {
            case 0:
              e(a);
              break;
            case 1:
              e(n[t[0]][s], a);
              break;
            case 2:
              e(n[t[0]][s], n[t[1]][s], a);
              break;
            default:
              for (var l = 0, u = []; l < i; l++)
                u[l] = n[t[l]][s];
              u[l] = a, e.apply(null, u);
          }
        }
    }, r.prototype.getDataExtent = function(t) {
      var e = this._chunks[t], i = Pi();
      if (!e)
        return i;
      var n = this.count(), a = !this._indices, o;
      if (a)
        return this._rawExtent[t].slice();
      if (o = this._extent[t], o)
        return o.slice();
      o = i;
      for (var s = o[0], l = o[1], u = 0; u < n; u++) {
        var f = this.getRawIndex(u), h = e[f];
        h < s && (s = h), h > l && (l = h);
      }
      return o = [s, l], this._extent[t] = o, o;
    }, r.prototype.getRawDataItem = function(t) {
      var e = this.getRawIndex(t);
      if (this._provider.persistent)
        return this._provider.getItem(e);
      for (var i = [], n = this._chunks, a = 0; a < n.length; a++)
        i.push(n[a][e]);
      return i;
    }, r.prototype.clone = function(t, e) {
      var i = new r(), n = this._chunks, a = t && We(t, function(s, l) {
        return s[l] = !0, s;
      }, {});
      if (a)
        for (var o = 0; o < n.length; o++)
          i._chunks[o] = a[o] ? mT(n[o]) : n[o];
      else
        i._chunks = n;
      return this._copyCommonProps(i), e || (i._indices = this._cloneIndices()), i._updateGetRawIdx(), i;
    }, r.prototype._copyCommonProps = function(t) {
      t._count = this._count, t._rawCount = this._rawCount, t._provider = this._provider, t._dimensions = this._dimensions, t._extent = U(this._extent), t._rawExtent = U(this._rawExtent);
    }, r.prototype._cloneIndices = function() {
      if (this._indices) {
        var t = this._indices.constructor, e = void 0;
        if (t === Array) {
          var i = this._indices.length;
          e = new t(i);
          for (var n = 0; n < i; n++)
            e[n] = this._indices[n];
        } else
          e = new t(this._indices);
        return e;
      }
      return null;
    }, r.prototype._getRawIdxIdentity = function(t) {
      return t;
    }, r.prototype._getRawIdx = function(t) {
      return t < this._count && t >= 0 ? this._indices[t] : -1;
    }, r.prototype._updateGetRawIdx = function() {
      this.getRawIndex = this._indices ? this._getRawIdx : this._getRawIdxIdentity;
    }, r.internalField = (function() {
      function t(e, i, n, a) {
        return Ki(e[a], this._dimensions[a]);
      }
      $l = {
        arrayRows: t,
        objectRows: function(e, i, n, a) {
          return Ki(e[i], this._dimensions[a]);
        },
        keyedColumns: t,
        original: function(e, i, n, a) {
          var o = e && (e.value == null ? e : e.value);
          return Ki(o instanceof Array ? o[a] : o, this._dimensions[a]);
        },
        typedArray: function(e, i, n, a) {
          return e[a];
        }
      };
    })(), r;
  })()
), _T = (
  /** @class */
  (function() {
    function r(t) {
      this._sourceList = [], this._storeList = [], this._upstreamSignList = [], this._versionSignBase = 0, this._dirty = !0, this._sourceHost = t;
    }
    return r.prototype.dirty = function() {
      this._setLocalSource([], []), this._storeList = [], this._dirty = !0;
    }, r.prototype._setLocalSource = function(t, e) {
      this._sourceList = t, this._upstreamSignList = e, this._versionSignBase++, this._versionSignBase > 9e10 && (this._versionSignBase = 0);
    }, r.prototype._getVersionSign = function() {
      return this._sourceHost.uid + "_" + this._versionSignBase;
    }, r.prototype.prepareSource = function() {
      this._isDirty() && (this._createSource(), this._dirty = !1);
    }, r.prototype._createSource = function() {
      this._setLocalSource([], []);
      var t = this._sourceHost, e = this._getUpstreamSourceManagers(), i = !!e.length, n, a;
      if (ro(t)) {
        var o = t, s = void 0, l = void 0, u = void 0;
        if (i) {
          var f = e[0];
          f.prepareSource(), u = f.getSource(), s = u.data, l = u.sourceFormat, a = [f._getVersionSign()];
        } else
          s = o.get("data", !0), l = Gt(s) ? xr : _e, a = [];
        var h = this._getSourceMetaRawOption() || {}, c = u && u.metaRawOption || {}, v = Z(h.seriesLayoutBy, c.seriesLayoutBy) || null, p = Z(h.sourceHeader, c.sourceHeader), g = Z(h.dimensions, c.dimensions), d = v !== c.seriesLayoutBy || !!p != !!c.sourceHeader || g;
        n = d ? [cf(s, {
          seriesLayoutBy: v,
          sourceHeader: p,
          dimensions: g
        }, l)] : [];
      } else {
        var y = t;
        if (i) {
          var m = this._applyTransform(e);
          n = m.sourceList, a = m.upstreamSignList;
        } else {
          var _ = y.get("source", !0);
          n = [cf(_, this._getSourceMetaRawOption(), null)], a = [];
        }
      }
      this._setLocalSource(n, a);
    }, r.prototype._applyTransform = function(t) {
      var e = this._sourceHost, i = e.get("transform", !0), n = e.get("fromTransformResult", !0);
      if (n != null) {
        var a = "";
        t.length !== 1 && ep(a);
      }
      var o, s = [], l = [];
      return T(t, function(u) {
        u.prepareSource();
        var f = u.getSource(n || 0), h = "";
        n != null && !f && ep(h), s.push(f), l.push(u._getVersionSign());
      }), i ? o = pT(i, s, {
        datasetIndex: e.componentIndex
      }) : n != null && (o = [Jx(s[0])]), {
        sourceList: o,
        upstreamSignList: l
      };
    }, r.prototype._isDirty = function() {
      if (this._dirty)
        return !0;
      for (var t = this._getUpstreamSourceManagers(), e = 0; e < t.length; e++) {
        var i = t[e];
        if (
          // Consider the case that there is ancestor diry, call it recursively.
          // The performance is probably not an issue because usually the chain is not long.
          i._isDirty() || this._upstreamSignList[e] !== i._getVersionSign()
        )
          return !0;
      }
    }, r.prototype.getSource = function(t) {
      t = t || 0;
      var e = this._sourceList[t];
      if (!e) {
        var i = this._getUpstreamSourceManagers();
        return i[0] && i[0].getSource(t);
      }
      return e;
    }, r.prototype.getSharedDataStore = function(t) {
      var e = t.makeStoreSchema();
      return this._innerGetDataStore(e.dimensions, t.source, e.hash);
    }, r.prototype._innerGetDataStore = function(t, e, i) {
      var n = 0, a = this._storeList, o = a[n];
      o || (o = a[n] = {});
      var s = o[i];
      if (!s) {
        var l = this._getUpstreamSourceManagers()[0];
        ro(this._sourceHost) && l ? s = l._innerGetDataStore(t, e, i) : (s = new pf(), s.initData(new ym(e, t.length), t)), o[i] = s;
      }
      return s;
    }, r.prototype._getUpstreamSourceManagers = function() {
      var t = this._sourceHost;
      if (ro(t)) {
        var e = um(t);
        return e ? [e.getSourceManager()] : [];
      } else
        return z(Mx(t), function(i) {
          return i.getSourceManager();
        });
    }, r.prototype._getSourceMetaRawOption = function() {
      var t = this._sourceHost, e, i, n;
      if (ro(t))
        e = t.get("seriesLayoutBy", !0), i = t.get("sourceHeader", !0), n = t.get("dimensions", !0);
      else if (!this._getUpstreamSourceManagers().length) {
        var a = t;
        e = a.get("seriesLayoutBy", !0), i = a.get("sourceHeader", !0), n = a.get("dimensions", !0);
      }
      return {
        seriesLayoutBy: e,
        sourceHeader: i,
        dimensions: n
      };
    }, r;
  })()
);
function ro(r) {
  return r.mainType === "series";
}
function ep(r) {
  throw new Error(r);
}
var ST = "line-height:1";
function Tm(r) {
  var t = r.lineHeight;
  return t == null ? ST : "line-height:" + Ft(t + "") + "px";
}
function Cm(r, t) {
  var e = r.color || "#6e7079", i = r.fontSize || 12, n = r.fontWeight || "400", a = r.color || "#464646", o = r.fontSize || 14, s = r.fontWeight || "900";
  return t === "html" ? {
    // eslint-disable-next-line max-len
    nameStyle: "font-size:" + Ft(i + "") + "px;color:" + Ft(e) + ";font-weight:" + Ft(n + ""),
    // eslint-disable-next-line max-len
    valueStyle: "font-size:" + Ft(o + "") + "px;color:" + Ft(a) + ";font-weight:" + Ft(s + "")
  } : {
    nameStyle: {
      fontSize: i,
      fill: e,
      fontWeight: n
    },
    valueStyle: {
      fontSize: o,
      fill: a,
      fontWeight: s
    }
  };
}
var bT = [0, 10, 20, 30], wT = ["", `
`, `

`, `


`];
function gi(r, t) {
  return t.type = r, t;
}
function df(r) {
  return r.type === "section";
}
function Mm(r) {
  return df(r) ? xT : TT;
}
function Dm(r) {
  if (df(r)) {
    var t = 0, e = r.blocks.length, i = e > 1 || e > 0 && !r.noHeader;
    return T(r.blocks, function(n) {
      var a = Dm(n);
      a >= t && (t = a + +(i && // 0 always can not be readable gap level.
      (!a || df(n) && !n.noHeader)));
    }), t;
  }
  return 0;
}
function xT(r, t, e, i) {
  var n = t.noHeader, a = CT(Dm(t)), o = [], s = t.blocks || [];
  Ee(!s || O(s)), s = s || [];
  var l = r.orderMode;
  if (t.sortBlocks && l) {
    s = s.slice();
    var u = {
      valueAsc: "asc",
      valueDesc: "desc"
    };
    if (Mr(u, l)) {
      var f = new oT(u[l], null);
      s.sort(function(g, d) {
        return f.evaluate(g.sortParam, d.sortParam);
      });
    } else l === "seriesDesc" && s.reverse();
  }
  T(s, function(g, d) {
    var y = t.valueFormatter, m = Mm(g)(
      // Inherit valueFormatter
      y ? k(k({}, r), {
        valueFormatter: y
      }) : r,
      g,
      d > 0 ? a.html : 0,
      i
    );
    m != null && o.push(m);
  });
  var h = r.renderMode === "richText" ? o.join(a.richText) : gf(i, o.join(""), n ? e : a.html);
  if (n)
    return h;
  var c = vf(t.header, "ordinal", r.useUTC), v = Cm(i, r.renderMode).nameStyle, p = Tm(i);
  return r.renderMode === "richText" ? Am(r, c, v) + a.richText + h : gf(i, '<div style="' + v + ";" + p + ';">' + Ft(c) + "</div>" + h, e);
}
function TT(r, t, e, i) {
  var n = r.renderMode, a = t.noName, o = t.noValue, s = !t.markerType, l = t.name, u = r.useUTC, f = t.valueFormatter || r.valueFormatter || function(S) {
    return S = O(S) ? S : [S], z(S, function(w, b) {
      return vf(w, O(v) ? v[b] : v, u);
    });
  };
  if (!(a && o)) {
    var h = s ? "" : r.markupStyleCreator.makeTooltipMarker(t.markerType, t.markerColor || "#333", n), c = a ? "" : vf(l, "ordinal", u), v = t.valueType, p = o ? [] : f(t.value, t.dataIndex), g = !s || !a, d = !s && a, y = Cm(i, n), m = y.nameStyle, _ = y.valueStyle;
    return n === "richText" ? (s ? "" : h) + (a ? "" : Am(r, c, m)) + (o ? "" : AT(r, p, g, d, _)) : gf(i, (s ? "" : h) + (a ? "" : MT(c, !s, m)) + (o ? "" : DT(p, g, d, _)), e);
  }
}
function rp(r, t, e, i, n, a) {
  if (r) {
    var o = Mm(r), s = {
      useUTC: n,
      renderMode: e,
      orderMode: i,
      markupStyleCreator: t,
      valueFormatter: r.valueFormatter
    };
    return o(s, r, 0, a);
  }
}
function CT(r) {
  return {
    html: bT[r],
    richText: wT[r]
  };
}
function gf(r, t, e) {
  var i = '<div style="clear:both"></div>', n = "margin: " + e + "px 0 0", a = Tm(r);
  return '<div style="' + n + ";" + a + ';">' + t + i + "</div>";
}
function MT(r, t, e) {
  var i = t ? "margin-left:2px" : "";
  return '<span style="' + e + ";" + i + '">' + Ft(r) + "</span>";
}
function DT(r, t, e, i) {
  var n = e ? "10px" : "20px", a = t ? "float:right;margin-left:" + n : "";
  return r = O(r) ? r : [r], '<span style="' + a + ";" + i + '">' + z(r, function(o) {
    return Ft(o);
  }).join("&nbsp;&nbsp;") + "</span>";
}
function Am(r, t, e) {
  return r.markupStyleCreator.wrapRichTextStyle(t, e);
}
function AT(r, t, e, i, n) {
  var a = [n], o = i ? 10 : 20;
  return e && a.push({
    padding: [0, 0, 0, o],
    align: "right"
  }), r.markupStyleCreator.wrapRichTextStyle(O(t) ? t.join("  ") : t, a);
}
function IT(r, t) {
  var e = r.getData().getItemVisual(t, "style"), i = e[r.visualDrawType];
  return di(i);
}
function Im(r, t) {
  var e = r.get("padding");
  return e ?? (t === "richText" ? [8, 10] : 10);
}
var Zl = (
  /** @class */
  (function() {
    function r() {
      this.richTextStyles = {}, this._nextStyleNameId = ry();
    }
    return r.prototype._generateStyleName = function() {
      return "__EC_aUTo_" + this._nextStyleNameId++;
    }, r.prototype.makeTooltipMarker = function(t, e, i) {
      var n = i === "richText" ? this._generateStyleName() : null, a = nm({
        color: e,
        type: t,
        renderMode: i,
        markerId: n
      });
      return V(a) ? a : (this.richTextStyles[n] = a.style, a.content);
    }, r.prototype.wrapRichTextStyle = function(t, e) {
      var i = {};
      O(e) ? T(e, function(a) {
        return k(i, a);
      }) : k(i, e);
      var n = this._generateStyleName();
      return this.richTextStyles[n] = i, "{" + n + "|" + t + "}";
    }, r;
  })()
);
function LT(r) {
  var t = r.series, e = r.dataIndex, i = r.multipleSeries, n = t.getData(), a = n.mapDimensionsAll("defaultedTooltip"), o = a.length, s = t.getRawValue(e), l = O(s), u = IT(t, e), f, h, c, v;
  if (o > 1 || l && !o) {
    var p = PT(s, t, e, a, u);
    f = p.inlineValues, h = p.inlineValueTypes, c = p.blocks, v = p.inlineValues[0];
  } else if (o) {
    var g = n.getDimensionInfo(a[0]);
    v = f = tn(n, e, a[0]), h = g.type;
  } else
    v = f = l ? s[0] : s;
  var d = hh(t), y = d && t.name || "", m = n.getName(e), _ = i ? y : m;
  return gi("section", {
    header: y,
    // When series name is not specified, do not show a header line with only '-'.
    // This case always happens in tooltip.trigger: 'item'.
    noHeader: i || !d,
    sortParam: v,
    blocks: [gi("nameValue", {
      markerType: "item",
      markerColor: u,
      // Do not mix display seriesName and itemName in one tooltip,
      // which might confuses users.
      name: _,
      // name dimension might be auto assigned, where the name might
      // be not readable. So we check trim here.
      noName: !Me(_),
      value: f,
      valueType: h,
      dataIndex: e
    })].concat(c || [])
  });
}
function PT(r, t, e, i, n) {
  var a = t.getData(), o = We(r, function(h, c, v) {
    var p = a.getDimensionInfo(v);
    return h = h || p && p.tooltip !== !1 && p.displayName != null;
  }, !1), s = [], l = [], u = [];
  i.length ? T(i, function(h) {
    f(tn(a, e, h), h);
  }) : T(r, f);
  function f(h, c) {
    var v = a.getDimensionInfo(c);
    !v || v.otherDims.tooltip === !1 || (o ? u.push(gi("nameValue", {
      markerType: "subItem",
      markerColor: n,
      name: v.displayName,
      value: h,
      valueType: v.type
    })) : (s.push(h), l.push(v.type)));
  }
  return {
    inlineValues: s,
    inlineValueTypes: l,
    blocks: u
  };
}
var sr = bt();
function io(r, t) {
  return r.getName(t) || r.getId(t);
}
var RT = "__universalTransitionEnabled", Ut = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e._selectedDataIndicesMap = {}, e;
    }
    return t.prototype.init = function(e, i, n) {
      this.seriesIndex = this.componentIndex, this.dataTask = Zn({
        count: OT,
        reset: kT
      }), this.dataTask.context = {
        model: this
      }, this.mergeDefaultAndTheme(e, n);
      var a = sr(this).sourceManager = new _T(this);
      a.prepareSource();
      var o = this.getInitialData(e, n);
      np(o, this), this.dataTask.context.data = o, sr(this).dataBeforeProcessed = o, ip(this), this._initSelectedMapFromData(o);
    }, t.prototype.mergeDefaultAndTheme = function(e, i) {
      var n = ha(this), a = n ? Xs(e) : {}, o = this.subType;
      rt.hasClass(o) && (o += "Series"), j(e, i.getTheme().get(this.subType)), j(e, this.getDefaultOption()), ju(e, "label", ["show"]), this.fillDataTextStyle(e.data), n && ji(e, a, n);
    }, t.prototype.mergeOption = function(e, i) {
      e = j(this.option, e, !0), this.fillDataTextStyle(e.data);
      var n = ha(this);
      n && ji(this.option, e, n);
      var a = sr(this).sourceManager;
      a.dirty(), a.prepareSource();
      var o = this.getInitialData(e, i);
      np(o, this), this.dataTask.dirty(), this.dataTask.context.data = o, sr(this).dataBeforeProcessed = o, ip(this), this._initSelectedMapFromData(o);
    }, t.prototype.fillDataTextStyle = function(e) {
      if (e && !Gt(e))
        for (var i = ["show"], n = 0; n < e.length; n++)
          e[n] && e[n].label && ju(e[n], "label", i);
    }, t.prototype.getInitialData = function(e, i) {
    }, t.prototype.appendData = function(e) {
      var i = this.getRawData();
      i.appendData(e.data);
    }, t.prototype.getData = function(e) {
      var i = yf(this);
      if (i) {
        var n = i.context.data;
        return e == null || !n.getLinkedData ? n : n.getLinkedData(e);
      } else
        return sr(this).data;
    }, t.prototype.getAllData = function() {
      var e = this.getData();
      return e && e.getLinkedDataAll ? e.getLinkedDataAll() : [{
        data: e
      }];
    }, t.prototype.setData = function(e) {
      var i = yf(this);
      if (i) {
        var n = i.context;
        n.outputData = e, i !== this.dataTask && (n.data = e);
      }
      sr(this).data = e;
    }, t.prototype.getEncode = function() {
      var e = this.get("encode", !0);
      if (e)
        return q(e);
    }, t.prototype.getSourceManager = function() {
      return sr(this).sourceManager;
    }, t.prototype.getSource = function() {
      return this.getSourceManager().getSource();
    }, t.prototype.getRawData = function() {
      return sr(this).dataBeforeProcessed;
    }, t.prototype.getColorBy = function() {
      var e = this.get("colorBy");
      return e || "series";
    }, t.prototype.isColorBySeries = function() {
      return this.getColorBy() === "series";
    }, t.prototype.getBaseAxis = function() {
      var e = this.coordinateSystem;
      return e && e.getBaseAxis && e.getBaseAxis();
    }, t.prototype.formatTooltip = function(e, i, n) {
      return LT({
        series: this,
        dataIndex: e,
        multipleSeries: i
      });
    }, t.prototype.isAnimationEnabled = function() {
      var e = this.ecModel;
      if (Y.node && !(e && e.ssr))
        return !1;
      var i = this.getShallow("animation");
      return i && this.getData().count() > this.getShallow("animationThreshold") && (i = !1), !!i;
    }, t.prototype.restoreData = function() {
      this.dataTask.dirty();
    }, t.prototype.getColorFromPalette = function(e, i, n) {
      var a = this.ecModel, o = Eh.prototype.getColorFromPalette.call(this, e, i, n);
      return o || (o = a.getColorFromPalette(e, i, n)), o;
    }, t.prototype.coordDimToDataDim = function(e) {
      return this.getRawData().mapDimensionsAll(e);
    }, t.prototype.getProgressive = function() {
      return this.get("progressive");
    }, t.prototype.getProgressiveThreshold = function() {
      return this.get("progressiveThreshold");
    }, t.prototype.select = function(e, i) {
      this._innerSelect(this.getData(i), e);
    }, t.prototype.unselect = function(e, i) {
      var n = this.option.selectedMap;
      if (n) {
        var a = this.option.selectedMode, o = this.getData(i);
        if (a === "series" || n === "all") {
          this.option.selectedMap = {}, this._selectedDataIndicesMap = {};
          return;
        }
        for (var s = 0; s < e.length; s++) {
          var l = e[s], u = io(o, l);
          n[u] = !1, this._selectedDataIndicesMap[u] = -1;
        }
      }
    }, t.prototype.toggleSelect = function(e, i) {
      for (var n = [], a = 0; a < e.length; a++)
        n[0] = e[a], this.isSelected(e[a], i) ? this.unselect(n, i) : this.select(n, i);
    }, t.prototype.getSelectedDataIndices = function() {
      if (this.option.selectedMap === "all")
        return [].slice.call(this.getData().getIndices());
      for (var e = this._selectedDataIndicesMap, i = ct(e), n = [], a = 0; a < i.length; a++) {
        var o = e[i[a]];
        o >= 0 && n.push(o);
      }
      return n;
    }, t.prototype.isSelected = function(e, i) {
      var n = this.option.selectedMap;
      if (!n)
        return !1;
      var a = this.getData(i);
      return (n === "all" || n[io(a, e)]) && !a.getItemModel(e).get(["select", "disabled"]);
    }, t.prototype.isUniversalTransitionEnabled = function() {
      if (this[RT])
        return !0;
      var e = this.option.universalTransition;
      return e ? e === !0 ? !0 : e && e.enabled : !1;
    }, t.prototype._innerSelect = function(e, i) {
      var n, a, o = this.option, s = o.selectedMode, l = i.length;
      if (!(!s || !l)) {
        if (s === "series")
          o.selectedMap = "all";
        else if (s === "multiple") {
          H(o.selectedMap) || (o.selectedMap = {});
          for (var u = o.selectedMap, f = 0; f < l; f++) {
            var h = i[f], c = io(e, h);
            u[c] = !0, this._selectedDataIndicesMap[c] = e.getRawIndex(h);
          }
        } else if (s === "single" || s === !0) {
          var v = i[l - 1], c = io(e, v);
          o.selectedMap = (n = {}, n[c] = !0, n), this._selectedDataIndicesMap = (a = {}, a[c] = e.getRawIndex(v), a);
        }
      }
    }, t.prototype._initSelectedMapFromData = function(e) {
      if (!this.option.selectedMap) {
        var i = [];
        e.hasItemOption && e.each(function(n) {
          var a = e.getRawDataItem(n);
          a && a.selected && i.push(n);
        }), i.length > 0 && this._innerSelect(e, i);
      }
    }, t.registerClass = function(e) {
      return rt.registerClass(e);
    }, t.protoInitialize = (function() {
      var e = t.prototype;
      e.type = "series.__base__", e.seriesIndex = 0, e.ignoreStyleOnData = !1, e.hasSymbolVisual = !1, e.defaultSymbol = "circle", e.visualStyleAccessPath = "itemStyle", e.visualDrawType = "fill";
    })(), t;
  })(rt)
);
ie(Ut, Bh);
ie(Ut, Eh);
ly(Ut, rt);
function ip(r) {
  var t = r.name;
  hh(r) || (r.name = ET(r) || t);
}
function ET(r) {
  var t = r.getRawData(), e = t.mapDimensionsAll("seriesName"), i = [];
  return T(e, function(n) {
    var a = t.getDimensionInfo(n);
    a.displayName && i.push(a.displayName);
  }), i.join(" ");
}
function OT(r) {
  return r.model.getRawData().count();
}
function kT(r) {
  var t = r.model;
  return t.setData(t.getRawData().cloneShallow()), NT;
}
function NT(r, t) {
  t.outputData && r.end > t.outputData.count() && t.model.getRawData().cloneShallow(t.outputData);
}
function np(r, t) {
  T(Mg(r.CHANGABLE_METHODS, r.DOWNSAMPLE_METHODS), function(e) {
    r.wrapMethod(e, ht(BT, t));
  });
}
function BT(r, t) {
  var e = yf(r);
  return e && e.setOutputEnd((t || this).count()), t;
}
function yf(r) {
  var t = (r.ecModel || {}).scheduler, e = t && t.getPipeline(r.uid);
  if (e) {
    var i = e.currentTask;
    if (i) {
      var n = i.agentStubMap;
      n && (i = n.get(r.uid));
    }
    return i;
  }
}
var kt = (
  /** @class */
  (function() {
    function r() {
      this.group = new gt(), this.uid = Vs("viewComponent");
    }
    return r.prototype.init = function(t, e) {
    }, r.prototype.render = function(t, e, i, n) {
    }, r.prototype.dispose = function(t, e) {
    }, r.prototype.updateView = function(t, e, i, n) {
    }, r.prototype.updateLayout = function(t, e, i, n) {
    }, r.prototype.updateVisual = function(t, e, i, n) {
    }, r.prototype.toggleBlurSeries = function(t, e, i) {
    }, r.prototype.eachRendered = function(t) {
      var e = this.group;
      e && e.traverse(t);
    }, r;
  })()
);
ch(kt);
Cs(kt);
function Fh() {
  var r = bt();
  return function(t) {
    var e = r(t), i = t.pipelineContext, n = !!e.large, a = !!e.progressiveRender, o = e.large = !!(i && i.large), s = e.progressiveRender = !!(i && i.progressiveRender);
    return (n !== o || a !== s) && "reset";
  };
}
var Lm = bt(), zT = Fh(), Et = (
  /** @class */
  (function() {
    function r() {
      this.group = new gt(), this.uid = Vs("viewChart"), this.renderTask = Zn({
        plan: FT,
        reset: VT
      }), this.renderTask.context = {
        view: this
      };
    }
    return r.prototype.init = function(t, e) {
    }, r.prototype.render = function(t, e, i, n) {
    }, r.prototype.highlight = function(t, e, i, n) {
      var a = t.getData(n && n.dataType);
      a && op(a, n, "emphasis");
    }, r.prototype.downplay = function(t, e, i, n) {
      var a = t.getData(n && n.dataType);
      a && op(a, n, "normal");
    }, r.prototype.remove = function(t, e) {
      this.group.removeAll();
    }, r.prototype.dispose = function(t, e) {
    }, r.prototype.updateView = function(t, e, i, n) {
      this.render(t, e, i, n);
    }, r.prototype.updateLayout = function(t, e, i, n) {
      this.render(t, e, i, n);
    }, r.prototype.updateVisual = function(t, e, i, n) {
      this.render(t, e, i, n);
    }, r.prototype.eachRendered = function(t) {
      rn(this.group, t);
    }, r.markUpdateMethod = function(t, e) {
      Lm(t).updateMethod = e;
    }, r.protoInitialize = (function() {
      var t = r.prototype;
      t.type = "chart";
    })(), r;
  })()
);
function ap(r, t, e) {
  r && sf(r) && (t === "emphasis" ? sa : la)(r, e);
}
function op(r, t, e) {
  var i = ci(r, t), n = t && t.highlightKey != null ? uw(t.highlightKey) : null;
  i != null ? T(Dt(i), function(a) {
    ap(r.getItemGraphicEl(a), e, n);
  }) : r.eachItemGraphicEl(function(a) {
    ap(a, e, n);
  });
}
ch(Et);
Cs(Et);
function FT(r) {
  return zT(r.model);
}
function VT(r) {
  var t = r.model, e = r.ecModel, i = r.api, n = r.payload, a = t.pipelineContext.progressiveRender, o = r.view, s = n && Lm(n).updateMethod, l = a ? "incrementalPrepareRender" : s && o[s] ? s : "render";
  return l !== "render" && o[l](t, e, i, n), HT[l];
}
var HT = {
  incrementalPrepareRender: {
    progress: function(r, t) {
      t.view.incrementalRender(r, t.model, t.ecModel, t.api, t.payload);
    }
  },
  render: {
    // Put view.render in `progress` to support appendData. But in this case
    // view.render should not be called in reset, otherwise it will be called
    // twise. Use `forceFirstProgress` to make sure that view.render is called
    // in any cases.
    forceFirstProgress: !0,
    progress: function(r, t) {
      t.view.render(t.model, t.ecModel, t.api, t.payload);
    }
  }
}, os = "\0__throttleOriginMethod", sp = "\0__throttleRate", lp = "\0__throttleType";
function qs(r, t, e) {
  var i, n = 0, a = 0, o = null, s, l, u, f;
  t = t || 0;
  function h() {
    a = (/* @__PURE__ */ new Date()).getTime(), o = null, r.apply(l, u || []);
  }
  var c = function() {
    for (var v = [], p = 0; p < arguments.length; p++)
      v[p] = arguments[p];
    i = (/* @__PURE__ */ new Date()).getTime(), l = this, u = v;
    var g = f || t, d = f || e;
    f = null, s = i - (d ? n : a) - g, clearTimeout(o), d ? o = setTimeout(h, g) : s >= 0 ? h() : o = setTimeout(h, -s), n = i;
  };
  return c.clear = function() {
    o && (clearTimeout(o), o = null);
  }, c.debounceNextCall = function(v) {
    f = v;
  }, c;
}
function Pm(r, t, e, i) {
  var n = r[t];
  if (n) {
    var a = n[os] || n, o = n[lp], s = n[sp];
    if (s !== e || o !== i) {
      if (e == null || !i)
        return r[t] = a;
      n = r[t] = qs(a, e, i === "debounce"), n[os] = a, n[lp] = i, n[sp] = e;
    }
    return n;
  }
}
function mf(r, t) {
  var e = r[t];
  e && e[os] && (e.clear && e.clear(), r[t] = e[os]);
}
var up = bt(), fp = {
  itemStyle: oa(Zy, !0),
  lineStyle: oa($y, !0)
}, GT = {
  lineStyle: "stroke",
  itemStyle: "fill"
};
function Rm(r, t) {
  var e = r.visualStyleMapper || fp[t];
  return e || (console.warn("Unknown style type '" + t + "'."), fp.itemStyle);
}
function Em(r, t) {
  var e = r.visualDrawType || GT[t];
  return e || (console.warn("Unknown style type '" + t + "'."), "fill");
}
var WT = {
  createOnAllSeries: !0,
  performRawSeries: !0,
  reset: function(r, t) {
    var e = r.getData(), i = r.visualStyleAccessPath || "itemStyle", n = r.getModel(i), a = Rm(r, i), o = a(n), s = n.getShallow("decal");
    s && (e.setVisual("decal", s), s.dirty = !0);
    var l = Em(r, i), u = o[l], f = X(u) ? u : null, h = o.fill === "auto" || o.stroke === "auto";
    if (!o[l] || f || h) {
      var c = r.getColorFromPalette(
        // TODO series count changed.
        r.name,
        null,
        t.getSeriesCount()
      );
      o[l] || (o[l] = c, e.setVisual("colorFromPalette", !0)), o.fill = o.fill === "auto" || X(o.fill) ? c : o.fill, o.stroke = o.stroke === "auto" || X(o.stroke) ? c : o.stroke;
    }
    if (e.setVisual("style", o), e.setVisual("drawType", l), !t.isSeriesFiltered(r) && f)
      return e.setVisual("colorFromPalette", !1), {
        dataEach: function(v, p) {
          var g = r.getDataParams(p), d = k({}, o);
          d[l] = f(g), v.setItemVisual(p, "style", d);
        }
      };
  }
}, Sn = new pt(), UT = {
  createOnAllSeries: !0,
  performRawSeries: !0,
  reset: function(r, t) {
    if (!(r.ignoreStyleOnData || t.isSeriesFiltered(r))) {
      var e = r.getData(), i = r.visualStyleAccessPath || "itemStyle", n = Rm(r, i), a = e.getVisual("drawType");
      return {
        dataEach: e.hasItemOption ? function(o, s) {
          var l = o.getRawDataItem(s);
          if (l && l[i]) {
            Sn.option = l[i];
            var u = n(Sn), f = o.ensureUniqueItemVisual(s, "style");
            k(f, u), Sn.option.decal && (o.setItemVisual(s, "decal", Sn.option.decal), Sn.option.decal.dirty = !0), a in u && o.setItemVisual(s, "colorFromPalette", !1);
          }
        } : null
      };
    }
  }
}, YT = {
  performRawSeries: !0,
  overallReset: function(r) {
    var t = q();
    r.eachSeries(function(e) {
      var i = e.getColorBy();
      if (!e.isColorBySeries()) {
        var n = e.type + "-" + i, a = t.get(n);
        a || (a = {}, t.set(n, a)), up(e).scope = a;
      }
    }), r.eachSeries(function(e) {
      if (!(e.isColorBySeries() || r.isSeriesFiltered(e))) {
        var i = e.getRawData(), n = {}, a = e.getData(), o = up(e).scope, s = e.visualStyleAccessPath || "itemStyle", l = Em(e, s);
        a.each(function(u) {
          var f = a.getRawIndex(u);
          n[f] = u;
        }), i.each(function(u) {
          var f = n[u], h = a.getItemVisual(f, "colorFromPalette");
          if (h) {
            var c = a.ensureUniqueItemVisual(f, "style"), v = i.getName(u) || u + "", p = i.count();
            c[l] = e.getColorFromPalette(v, o, p);
          }
        });
      }
    });
  }
}, no = Math.PI;
function XT(r, t) {
  t = t || {}, at(t, {
    text: "loading",
    textColor: "#000",
    fontSize: 12,
    fontWeight: "normal",
    fontStyle: "normal",
    fontFamily: "sans-serif",
    maskColor: "rgba(255, 255, 255, 0.8)",
    showSpinner: !0,
    color: "#5470c6",
    spinnerRadius: 10,
    lineWidth: 5,
    zlevel: 0
  });
  var e = new gt(), i = new dt({
    style: {
      fill: t.maskColor
    },
    zlevel: t.zlevel,
    z: 1e4
  });
  e.add(i);
  var n = new mt({
    style: {
      text: t.text,
      fill: t.textColor,
      fontSize: t.fontSize,
      fontWeight: t.fontWeight,
      fontStyle: t.fontStyle,
      fontFamily: t.fontFamily
    },
    zlevel: t.zlevel,
    z: 10001
  }), a = new dt({
    style: {
      fill: "none"
    },
    textContent: n,
    textConfig: {
      position: "right",
      distance: 10
    },
    zlevel: t.zlevel,
    z: 10001
  });
  e.add(a);
  var o;
  return t.showSpinner && (o = new La({
    shape: {
      startAngle: -no / 2,
      endAngle: -no / 2 + 0.1,
      r: t.spinnerRadius
    },
    style: {
      stroke: t.color,
      lineCap: "round",
      lineWidth: t.lineWidth
    },
    zlevel: t.zlevel,
    z: 10001
  }), o.animateShape(!0).when(1e3, {
    endAngle: no * 3 / 2
  }).start("circularInOut"), o.animateShape(!0).when(1e3, {
    startAngle: no * 3 / 2
  }).delay(300).start("circularInOut"), e.add(o)), e.resize = function() {
    var s = n.getBoundingRect().width, l = t.showSpinner ? t.spinnerRadius : 0, u = (r.getWidth() - l * 2 - (t.showSpinner && s ? 10 : 0) - s) / 2 - (t.showSpinner && s ? 0 : 5 + s / 2) + (t.showSpinner ? 0 : s / 2) + (s ? 0 : l), f = r.getHeight() / 2;
    t.showSpinner && o.setShape({
      cx: u,
      cy: f
    }), a.setShape({
      x: u - l,
      y: f - l,
      width: l * 2,
      height: l * 2
    }), i.setShape({
      x: 0,
      y: 0,
      width: r.getWidth(),
      height: r.getHeight()
    });
  }, e.resize(), e;
}
var Om = (
  /** @class */
  (function() {
    function r(t, e, i, n) {
      this._stageTaskMap = q(), this.ecInstance = t, this.api = e, i = this._dataProcessorHandlers = i.slice(), n = this._visualHandlers = n.slice(), this._allHandlers = i.concat(n);
    }
    return r.prototype.restoreData = function(t, e) {
      t.restoreData(e), this._stageTaskMap.each(function(i) {
        var n = i.overallTask;
        n && n.dirty();
      });
    }, r.prototype.getPerformArgs = function(t, e) {
      if (t.__pipeline) {
        var i = this._pipelineMap.get(t.__pipeline.id), n = i.context, a = !e && i.progressiveEnabled && (!n || n.progressiveRender) && t.__idxInPipeline > i.blockIndex, o = a ? i.step : null, s = n && n.modDataCount, l = s != null ? Math.ceil(s / o) : null;
        return {
          step: o,
          modBy: l,
          modDataCount: s
        };
      }
    }, r.prototype.getPipeline = function(t) {
      return this._pipelineMap.get(t);
    }, r.prototype.updateStreamModes = function(t, e) {
      var i = this._pipelineMap.get(t.uid), n = t.getData(), a = n.count(), o = i.progressiveEnabled && e.incrementalPrepareRender && a >= i.threshold, s = t.get("large") && a >= t.get("largeThreshold"), l = t.get("progressiveChunkMode") === "mod" ? a : null;
      t.pipelineContext = i.context = {
        progressiveRender: o,
        modDataCount: l,
        large: s
      };
    }, r.prototype.restorePipelines = function(t) {
      var e = this, i = e._pipelineMap = q();
      t.eachSeries(function(n) {
        var a = n.getProgressive(), o = n.uid;
        i.set(o, {
          id: o,
          head: null,
          tail: null,
          threshold: n.getProgressiveThreshold(),
          progressiveEnabled: a && !(n.preventIncremental && n.preventIncremental()),
          blockIndex: -1,
          step: Math.round(a || 700),
          count: 0
        }), e._pipe(n, n.dataTask);
      });
    }, r.prototype.prepareStageTasks = function() {
      var t = this._stageTaskMap, e = this.api.getModel(), i = this.api;
      T(this._allHandlers, function(n) {
        var a = t.get(n.uid) || t.set(n.uid, {}), o = "";
        Ee(!(n.reset && n.overallReset), o), n.reset && this._createSeriesStageTask(n, a, e, i), n.overallReset && this._createOverallStageTask(n, a, e, i);
      }, this);
    }, r.prototype.prepareView = function(t, e, i, n) {
      var a = t.renderTask, o = a.context;
      o.model = e, o.ecModel = i, o.api = n, a.__block = !t.incrementalPrepareRender, this._pipe(e, a);
    }, r.prototype.performDataProcessorTasks = function(t, e) {
      this._performStageTasks(this._dataProcessorHandlers, t, e, {
        block: !0
      });
    }, r.prototype.performVisualTasks = function(t, e, i) {
      this._performStageTasks(this._visualHandlers, t, e, i);
    }, r.prototype._performStageTasks = function(t, e, i, n) {
      n = n || {};
      var a = !1, o = this;
      T(t, function(l, u) {
        if (!(n.visualType && n.visualType !== l.visualType)) {
          var f = o._stageTaskMap.get(l.uid), h = f.seriesTaskMap, c = f.overallTask;
          if (c) {
            var v, p = c.agentStubMap;
            p.each(function(d) {
              s(n, d) && (d.dirty(), v = !0);
            }), v && c.dirty(), o.updatePayload(c, i);
            var g = o.getPerformArgs(c, n.block);
            p.each(function(d) {
              d.perform(g);
            }), c.perform(g) && (a = !0);
          } else h && h.each(function(d, y) {
            s(n, d) && d.dirty();
            var m = o.getPerformArgs(d, n.block);
            m.skip = !l.performRawSeries && e.isSeriesFiltered(d.context.model), o.updatePayload(d, i), d.perform(m) && (a = !0);
          });
        }
      });
      function s(l, u) {
        return l.setDirty && (!l.dirtyMap || l.dirtyMap.get(u.__pipeline.id));
      }
      this.unfinished = a || this.unfinished;
    }, r.prototype.performSeriesTasks = function(t) {
      var e;
      t.eachSeries(function(i) {
        e = i.dataTask.perform() || e;
      }), this.unfinished = e || this.unfinished;
    }, r.prototype.plan = function() {
      this._pipelineMap.each(function(t) {
        var e = t.tail;
        do {
          if (e.__block) {
            t.blockIndex = e.__idxInPipeline;
            break;
          }
          e = e.getUpstream();
        } while (e);
      });
    }, r.prototype.updatePayload = function(t, e) {
      e !== "remain" && (t.context.payload = e);
    }, r.prototype._createSeriesStageTask = function(t, e, i, n) {
      var a = this, o = e.seriesTaskMap, s = e.seriesTaskMap = q(), l = t.seriesType, u = t.getTargetSeries;
      t.createOnAllSeries ? i.eachRawSeries(f) : l ? i.eachRawSeriesByType(l, f) : u && u(i, n).each(f);
      function f(h) {
        var c = h.uid, v = s.set(c, o && o.get(c) || Zn({
          plan: QT,
          reset: JT,
          count: tC
        }));
        v.context = {
          model: h,
          ecModel: i,
          api: n,
          // PENDING: `useClearVisual` not used?
          useClearVisual: t.isVisual && !t.isLayout,
          plan: t.plan,
          reset: t.reset,
          scheduler: a
        }, a._pipe(h, v);
      }
    }, r.prototype._createOverallStageTask = function(t, e, i, n) {
      var a = this, o = e.overallTask = e.overallTask || Zn({
        reset: $T
      });
      o.context = {
        ecModel: i,
        api: n,
        overallReset: t.overallReset,
        scheduler: a
      };
      var s = o.agentStubMap, l = o.agentStubMap = q(), u = t.seriesType, f = t.getTargetSeries, h = !0, c = !1, v = "";
      Ee(!t.createOnAllSeries, v), u ? i.eachRawSeriesByType(u, p) : f ? f(i, n).each(p) : (h = !1, T(i.getSeries(), p));
      function p(g) {
        var d = g.uid, y = l.set(d, s && s.get(d) || // When the result of `getTargetSeries` changed, the overallTask
        // should be set as dirty and re-performed.
        (c = !0, Zn({
          reset: ZT,
          onDirty: KT
        })));
        y.context = {
          model: g,
          overallProgress: h
          // FIXME:TS never used, so comment it
          // modifyOutputEnd: modifyOutputEnd
        }, y.agent = o, y.__block = h, a._pipe(g, y);
      }
      c && o.dirty();
    }, r.prototype._pipe = function(t, e) {
      var i = t.uid, n = this._pipelineMap.get(i);
      !n.head && (n.head = e), n.tail && n.tail.pipe(e), n.tail = e, e.__idxInPipeline = n.count++, e.__pipeline = n;
    }, r.wrapStageHandler = function(t, e) {
      return X(t) && (t = {
        overallReset: t,
        seriesType: eC(t)
      }), t.uid = Vs("stageHandler"), e && (t.visualType = e), t;
    }, r;
  })()
);
function $T(r) {
  r.overallReset(r.ecModel, r.api, r.payload);
}
function ZT(r) {
  return r.overallProgress && qT;
}
function qT() {
  this.agent.dirty(), this.getDownstream().dirty();
}
function KT() {
  this.agent && this.agent.dirty();
}
function QT(r) {
  return r.plan ? r.plan(r.model, r.ecModel, r.api, r.payload) : null;
}
function JT(r) {
  r.useClearVisual && r.data.clearAllVisual();
  var t = r.resetDefines = Dt(r.reset(r.model, r.ecModel, r.api, r.payload));
  return t.length > 1 ? z(t, function(e, i) {
    return km(i);
  }) : jT;
}
var jT = km(0);
function km(r) {
  return function(t, e) {
    var i = e.data, n = e.resetDefines[r];
    if (n && n.dataEach)
      for (var a = t.start; a < t.end; a++)
        n.dataEach(i, a);
    else n && n.progress && n.progress(t, i);
  };
}
function tC(r) {
  return r.data.count();
}
function eC(r) {
  ss = null;
  try {
    r(ca, Nm);
  } catch {
  }
  return ss;
}
var ca = {}, Nm = {}, ss;
Bm(ca, Oh);
Bm(Nm, hm);
ca.eachSeriesByType = ca.eachRawSeriesByType = function(r) {
  ss = r;
};
ca.eachComponent = function(r) {
  r.mainType === "series" && r.subType && (ss = r.subType);
};
function Bm(r, t) {
  for (var e in t.prototype)
    r[e] = Rt;
}
var hp = ["#37A2DA", "#32C5E9", "#67E0E3", "#9FE6B8", "#FFDB5C", "#ff9f7f", "#fb7293", "#E062AE", "#E690D1", "#e7bcf3", "#9d96f5", "#8378EA", "#96BFFF"];
const rC = {
  color: hp,
  colorLayer: [["#37A2DA", "#ffd85c", "#fd7b5f"], ["#37A2DA", "#67E0E3", "#FFDB5C", "#ff9f7f", "#E062AE", "#9d96f5"], ["#37A2DA", "#32C5E9", "#9FE6B8", "#FFDB5C", "#ff9f7f", "#fb7293", "#e7bcf3", "#8378EA", "#96BFFF"], hp]
};
var Lt = "#B9B8CE", vp = "#100C2A", ao = function() {
  return {
    axisLine: {
      lineStyle: {
        color: Lt
      }
    },
    splitLine: {
      lineStyle: {
        color: "#484753"
      }
    },
    splitArea: {
      areaStyle: {
        color: ["rgba(255,255,255,0.02)", "rgba(255,255,255,0.05)"]
      }
    },
    minorSplitLine: {
      lineStyle: {
        color: "#20203B"
      }
    }
  };
}, cp = ["#4992ff", "#7cffb2", "#fddd60", "#ff6e76", "#58d9f9", "#05c091", "#ff8a45", "#8d48e3", "#dd79ff"], zm = {
  darkMode: !0,
  color: cp,
  backgroundColor: vp,
  axisPointer: {
    lineStyle: {
      color: "#817f91"
    },
    crossStyle: {
      color: "#817f91"
    },
    label: {
      // TODO Contrast of label backgorundColor
      color: "#fff"
    }
  },
  legend: {
    textStyle: {
      color: Lt
    },
    pageTextStyle: {
      color: Lt
    }
  },
  textStyle: {
    color: Lt
  },
  title: {
    textStyle: {
      color: "#EEF1FA"
    },
    subtextStyle: {
      color: "#B9B8CE"
    }
  },
  toolbox: {
    iconStyle: {
      borderColor: Lt
    }
  },
  dataZoom: {
    borderColor: "#71708A",
    textStyle: {
      color: Lt
    },
    brushStyle: {
      color: "rgba(135,163,206,0.3)"
    },
    handleStyle: {
      color: "#353450",
      borderColor: "#C5CBE3"
    },
    moveHandleStyle: {
      color: "#B0B6C3",
      opacity: 0.3
    },
    fillerColor: "rgba(135,163,206,0.2)",
    emphasis: {
      handleStyle: {
        borderColor: "#91B7F2",
        color: "#4D587D"
      },
      moveHandleStyle: {
        color: "#636D9A",
        opacity: 0.7
      }
    },
    dataBackground: {
      lineStyle: {
        color: "#71708A",
        width: 1
      },
      areaStyle: {
        color: "#71708A"
      }
    },
    selectedDataBackground: {
      lineStyle: {
        color: "#87A3CE"
      },
      areaStyle: {
        color: "#87A3CE"
      }
    }
  },
  visualMap: {
    textStyle: {
      color: Lt
    }
  },
  timeline: {
    lineStyle: {
      color: Lt
    },
    label: {
      color: Lt
    },
    controlStyle: {
      color: Lt,
      borderColor: Lt
    }
  },
  calendar: {
    itemStyle: {
      color: vp
    },
    dayLabel: {
      color: Lt
    },
    monthLabel: {
      color: Lt
    },
    yearLabel: {
      color: Lt
    }
  },
  timeAxis: ao(),
  logAxis: ao(),
  valueAxis: ao(),
  categoryAxis: ao(),
  line: {
    symbol: "circle"
  },
  graph: {
    color: cp
  },
  gauge: {
    title: {
      color: Lt
    },
    axisLine: {
      lineStyle: {
        color: [[1, "rgba(207,212,219,0.2)"]]
      }
    },
    axisLabel: {
      color: Lt
    },
    detail: {
      color: "#EEF1FA"
    }
  },
  candlestick: {
    itemStyle: {
      color: "#f64e56",
      color0: "#54ea92",
      borderColor: "#f64e56",
      borderColor0: "#54ea92"
      // borderColor: '#ca2824',
      // borderColor0: '#09a443'
    }
  }
};
zm.categoryAxis.splitLine.show = !1;
var iC = (
  /** @class */
  (function() {
    function r() {
    }
    return r.prototype.normalizeQuery = function(t) {
      var e = {}, i = {}, n = {};
      if (V(t)) {
        var a = Ge(t);
        e.mainType = a.main || null, e.subType = a.sub || null;
      } else {
        var o = ["Index", "Name", "Id"], s = {
          name: 1,
          dataIndex: 1,
          dataType: 1
        };
        T(t, function(l, u) {
          for (var f = !1, h = 0; h < o.length; h++) {
            var c = o[h], v = u.lastIndexOf(c);
            if (v > 0 && v === u.length - c.length) {
              var p = u.slice(0, v);
              p !== "data" && (e.mainType = p, e[c.toLowerCase()] = l, f = !0);
            }
          }
          s.hasOwnProperty(u) && (i[u] = l, f = !0), f || (n[u] = l);
        });
      }
      return {
        cptQuery: e,
        dataQuery: i,
        otherQuery: n
      };
    }, r.prototype.filter = function(t, e) {
      var i = this.eventInfo;
      if (!i)
        return !0;
      var n = i.targetEl, a = i.packedEvent, o = i.model, s = i.view;
      if (!o || !s)
        return !0;
      var l = e.cptQuery, u = e.dataQuery;
      return f(l, o, "mainType") && f(l, o, "subType") && f(l, o, "index", "componentIndex") && f(l, o, "name") && f(l, o, "id") && f(u, a, "name") && f(u, a, "dataIndex") && f(u, a, "dataType") && (!s.filterForExposedEvent || s.filterForExposedEvent(t, e.otherQuery, n, a));
      function f(h, c, v, p) {
        return h[v] == null || c[p || v] === h[v];
      }
    }, r.prototype.afterTrigger = function() {
      this.eventInfo = null;
    }, r;
  })()
), _f = ["symbol", "symbolSize", "symbolRotate", "symbolOffset"], pp = _f.concat(["symbolKeepAspect"]), nC = {
  createOnAllSeries: !0,
  // For legend.
  performRawSeries: !0,
  reset: function(r, t) {
    var e = r.getData();
    if (r.legendIcon && e.setVisual("legendIcon", r.legendIcon), !r.hasSymbolVisual)
      return;
    for (var i = {}, n = {}, a = !1, o = 0; o < _f.length; o++) {
      var s = _f[o], l = r.get(s);
      X(l) ? (a = !0, n[s] = l) : i[s] = l;
    }
    if (i.symbol = i.symbol || r.defaultSymbol, e.setVisual(k({
      legendIcon: r.legendIcon || i.symbol,
      symbolKeepAspect: r.get("symbolKeepAspect")
    }, i)), t.isSeriesFiltered(r))
      return;
    var u = ct(n);
    function f(h, c) {
      for (var v = r.getRawValue(c), p = r.getDataParams(c), g = 0; g < u.length; g++) {
        var d = u[g];
        h.setItemVisual(c, d, n[d](v, p));
      }
    }
    return {
      dataEach: a ? f : null
    };
  }
}, aC = {
  createOnAllSeries: !0,
  // For legend.
  performRawSeries: !0,
  reset: function(r, t) {
    if (!r.hasSymbolVisual || t.isSeriesFiltered(r))
      return;
    var e = r.getData();
    function i(n, a) {
      for (var o = n.getItemModel(a), s = 0; s < pp.length; s++) {
        var l = pp[s], u = o.getShallow(l, !0);
        u != null && n.setItemVisual(a, l, u);
      }
    }
    return {
      dataEach: e.hasItemOption ? i : null
    };
  }
};
function Fm(r, t, e) {
  switch (e) {
    case "color":
      var i = r.getItemVisual(t, "style");
      return i[r.getVisual("drawType")];
    case "opacity":
      return r.getItemVisual(t, "style").opacity;
    case "symbol":
    case "symbolSize":
    case "liftZ":
      return r.getItemVisual(t, e);
  }
}
function Vh(r, t) {
  switch (t) {
    case "color":
      var e = r.getVisual("style");
      return e[r.getVisual("drawType")];
    case "opacity":
      return r.getVisual("style").opacity;
    case "symbol":
    case "symbolSize":
    case "liftZ":
      return r.getVisual(t);
  }
}
function oC(r, t, e, i) {
  switch (e) {
    case "color":
      var n = r.ensureUniqueItemVisual(t, "style");
      n[r.getVisual("drawType")] = i, r.setItemVisual(t, "colorFromPalette", !1);
      break;
    case "opacity":
      r.ensureUniqueItemVisual(t, "style").opacity = i;
      break;
    case "symbol":
    case "symbolSize":
    case "liftZ":
      r.setItemVisual(t, e, i);
      break;
  }
}
function Ri(r, t, e, i, n) {
  var a = r + t;
  e.isSilent(a) || i.eachComponent({
    mainType: "series",
    subType: "pie"
  }, function(o) {
    for (var s = o.seriesIndex, l = o.option.selectedMap, u = n.selected, f = 0; f < u.length; f++)
      if (u[f].seriesIndex === s) {
        var h = o.getData(), c = ci(h, n.fromActionPayload);
        e.trigger(a, {
          type: a,
          seriesId: o.id,
          name: O(c) ? h.getName(c[0]) : h.getName(c),
          selected: V(l) ? l : k({}, l)
        });
      }
  });
}
function sC(r, t, e) {
  r.on("selectchanged", function(i) {
    var n = e.getModel();
    i.isFromClick ? (Ri("map", "selectchanged", t, n, i), Ri("pie", "selectchanged", t, n, i)) : i.fromAction === "select" ? (Ri("map", "selected", t, n, i), Ri("pie", "selected", t, n, i)) : i.fromAction === "unselect" && (Ri("map", "unselected", t, n, i), Ri("pie", "unselected", t, n, i));
  });
}
function Gi(r, t, e) {
  for (var i; r && !(t(r) && (i = r, e)); )
    r = r.__hostTarget || r.parent;
  return i;
}
var lC = Math.round(Math.random() * 9), uC = typeof Object.defineProperty == "function", fC = (function() {
  function r() {
    this._id = "__ec_inner_" + lC++;
  }
  return r.prototype.get = function(t) {
    return this._guard(t)[this._id];
  }, r.prototype.set = function(t, e) {
    var i = this._guard(t);
    return uC ? Object.defineProperty(i, this._id, {
      value: e,
      enumerable: !1,
      configurable: !0
    }) : i[this._id] = e, this;
  }, r.prototype.delete = function(t) {
    return this.has(t) ? (delete this._guard(t)[this._id], !0) : !1;
  }, r.prototype.has = function(t) {
    return !!this._guard(t)[this._id];
  }, r.prototype._guard = function(t) {
    if (t !== Object(t))
      throw TypeError("Value of WeakMap is not a non-null object.");
    return t;
  }, r;
})(), hC = ot.extend({
  type: "triangle",
  shape: {
    cx: 0,
    cy: 0,
    width: 0,
    height: 0
  },
  buildPath: function(r, t) {
    var e = t.cx, i = t.cy, n = t.width / 2, a = t.height / 2;
    r.moveTo(e, i - a), r.lineTo(e + n, i + a), r.lineTo(e - n, i + a), r.closePath();
  }
}), vC = ot.extend({
  type: "diamond",
  shape: {
    cx: 0,
    cy: 0,
    width: 0,
    height: 0
  },
  buildPath: function(r, t) {
    var e = t.cx, i = t.cy, n = t.width / 2, a = t.height / 2;
    r.moveTo(e, i - a), r.lineTo(e + n, i), r.lineTo(e, i + a), r.lineTo(e - n, i), r.closePath();
  }
}), cC = ot.extend({
  type: "pin",
  shape: {
    // x, y on the cusp
    x: 0,
    y: 0,
    width: 0,
    height: 0
  },
  buildPath: function(r, t) {
    var e = t.x, i = t.y, n = t.width / 5 * 3, a = Math.max(n, t.height), o = n / 2, s = o * o / (a - o), l = i - a + o + s, u = Math.asin(s / o), f = Math.cos(u) * o, h = Math.sin(u), c = Math.cos(u), v = o * 0.6, p = o * 0.7;
    r.moveTo(e - f, l + s), r.arc(e, l, o, Math.PI - u, Math.PI * 2 + u), r.bezierCurveTo(e + f - h * v, l + s + c * v, e, i - p, e, i), r.bezierCurveTo(e, i - p, e - f + h * v, l + s + c * v, e - f, l + s), r.closePath();
  }
}), pC = ot.extend({
  type: "arrow",
  shape: {
    x: 0,
    y: 0,
    width: 0,
    height: 0
  },
  buildPath: function(r, t) {
    var e = t.height, i = t.width, n = t.x, a = t.y, o = i / 3 * 2;
    r.moveTo(n, a), r.lineTo(n + o, a + e), r.lineTo(n, a + e / 4 * 3), r.lineTo(n - o, a + e), r.lineTo(n, a), r.closePath();
  }
}), dC = {
  line: Xe,
  rect: dt,
  roundRect: dt,
  square: dt,
  circle: Da,
  diamond: vC,
  pin: cC,
  arrow: pC,
  triangle: hC
}, gC = {
  line: function(r, t, e, i, n) {
    n.x1 = r, n.y1 = t + i / 2, n.x2 = r + e, n.y2 = t + i / 2;
  },
  rect: function(r, t, e, i, n) {
    n.x = r, n.y = t, n.width = e, n.height = i;
  },
  roundRect: function(r, t, e, i, n) {
    n.x = r, n.y = t, n.width = e, n.height = i, n.r = Math.min(e, i) / 4;
  },
  square: function(r, t, e, i, n) {
    var a = Math.min(e, i);
    n.x = r, n.y = t, n.width = a, n.height = a;
  },
  circle: function(r, t, e, i, n) {
    n.cx = r + e / 2, n.cy = t + i / 2, n.r = Math.min(e, i) / 2;
  },
  diamond: function(r, t, e, i, n) {
    n.cx = r + e / 2, n.cy = t + i / 2, n.width = e, n.height = i;
  },
  pin: function(r, t, e, i, n) {
    n.x = r + e / 2, n.y = t + i / 2, n.width = e, n.height = i;
  },
  arrow: function(r, t, e, i, n) {
    n.x = r + e / 2, n.y = t + i / 2, n.width = e, n.height = i;
  },
  triangle: function(r, t, e, i, n) {
    n.cx = r + e / 2, n.cy = t + i / 2, n.width = e, n.height = i;
  }
}, Sf = {};
T(dC, function(r, t) {
  Sf[t] = new r();
});
var yC = ot.extend({
  type: "symbol",
  shape: {
    symbolType: "",
    x: 0,
    y: 0,
    width: 0,
    height: 0
  },
  calculateTextPosition: function(r, t, e) {
    var i = Jo(r, t, e), n = this.shape;
    return n && n.symbolType === "pin" && t.position === "inside" && (i.y = e.y + e.height * 0.4), i;
  },
  buildPath: function(r, t, e) {
    var i = t.symbolType;
    if (i !== "none") {
      var n = Sf[i];
      n || (i = "rect", n = Sf[i]), gC[i](t.x, t.y, t.width, t.height, n.shape), n.buildPath(r, n.shape, e);
    }
  }
});
function mC(r, t) {
  if (this.type !== "image") {
    var e = this.style;
    this.__isEmptyBrush ? (e.stroke = r, e.fill = t || "#fff", e.lineWidth = 2) : this.shape.symbolType === "line" ? e.stroke = r : e.fill = r, this.markRedraw();
  }
}
function ge(r, t, e, i, n, a, o) {
  var s = r.indexOf("empty") === 0;
  s && (r = r.substr(5, 1).toLowerCase() + r.substr(6));
  var l;
  return r.indexOf("image://") === 0 ? l = bh(r.slice(8), new it(t, e, i, n), o ? "center" : "cover") : r.indexOf("path://") === 0 ? l = ks(r.slice(7), {}, new it(t, e, i, n), o ? "center" : "cover") : l = new yC({
    shape: {
      symbolType: r,
      x: t,
      y: e,
      width: i,
      height: n
    }
  }), l.__isEmptyBrush = s, l.setColor = mC, a && l.setColor(a), l;
}
function Hh(r) {
  return O(r) || (r = [+r, +r]), [r[0] || 0, r[1] || 0];
}
function Ks(r, t) {
  if (r != null)
    return O(r) || (r = [r, r]), [Mt(r[0], t[0]) || 0, Mt(Z(r[1], r[0]), t[1]) || 0];
}
function ni(r) {
  return isFinite(r);
}
function _C(r, t, e) {
  var i = t.x == null ? 0 : t.x, n = t.x2 == null ? 1 : t.x2, a = t.y == null ? 0 : t.y, o = t.y2 == null ? 0 : t.y2;
  t.global || (i = i * e.width + e.x, n = n * e.width + e.x, a = a * e.height + e.y, o = o * e.height + e.y), i = ni(i) ? i : 0, n = ni(n) ? n : 1, a = ni(a) ? a : 0, o = ni(o) ? o : 0;
  var s = r.createLinearGradient(i, a, n, o);
  return s;
}
function SC(r, t, e) {
  var i = e.width, n = e.height, a = Math.min(i, n), o = t.x == null ? 0.5 : t.x, s = t.y == null ? 0.5 : t.y, l = t.r == null ? 0.5 : t.r;
  t.global || (o = o * i + e.x, s = s * n + e.y, l = l * a), o = ni(o) ? o : 0.5, s = ni(s) ? s : 0.5, l = l >= 0 && ni(l) ? l : 0.5;
  var u = r.createRadialGradient(o, s, 0, o, s, l);
  return u;
}
function bf(r, t, e) {
  for (var i = t.type === "radial" ? SC(r, t, e) : _C(r, t, e), n = t.colorStops, a = 0; a < n.length; a++)
    i.addColorStop(n[a].offset, n[a].color);
  return i;
}
function bC(r, t) {
  if (r === t || !r && !t)
    return !1;
  if (!r || !t || r.length !== t.length)
    return !0;
  for (var e = 0; e < r.length; e++)
    if (r[e] !== t[e])
      return !0;
  return !1;
}
function oo(r) {
  return parseInt(r, 10);
}
function so(r, t, e) {
  var i = ["width", "height"][t], n = ["clientWidth", "clientHeight"][t], a = ["paddingLeft", "paddingTop"][t], o = ["paddingRight", "paddingBottom"][t];
  if (e[i] != null && e[i] !== "auto")
    return parseFloat(e[i]);
  var s = document.defaultView.getComputedStyle(r);
  return (r[n] || oo(s[i]) || oo(r.style[i])) - (oo(s[a]) || 0) - (oo(s[o]) || 0) | 0;
}
function wC(r, t) {
  return !r || r === "solid" || !(t > 0) ? null : r === "dashed" ? [4 * t, 2 * t] : r === "dotted" ? [t] : vt(r) ? [r] : O(r) ? r : null;
}
function Vm(r) {
  var t = r.style, e = t.lineDash && t.lineWidth > 0 && wC(t.lineDash, t.lineWidth), i = t.lineDashOffset;
  if (e) {
    var n = t.strokeNoScale && r.getLineScale ? r.getLineScale() : 1;
    n && n !== 1 && (e = z(e, function(a) {
      return a / n;
    }), i /= n);
  }
  return [e, i];
}
var xC = new pi(!0);
function ls(r) {
  var t = r.stroke;
  return !(t == null || t === "none" || !(r.lineWidth > 0));
}
function dp(r) {
  return typeof r == "string" && r !== "none";
}
function us(r) {
  var t = r.fill;
  return t != null && t !== "none";
}
function gp(r, t) {
  if (t.fillOpacity != null && t.fillOpacity !== 1) {
    var e = r.globalAlpha;
    r.globalAlpha = t.fillOpacity * t.opacity, r.fill(), r.globalAlpha = e;
  } else
    r.fill();
}
function yp(r, t) {
  if (t.strokeOpacity != null && t.strokeOpacity !== 1) {
    var e = r.globalAlpha;
    r.globalAlpha = t.strokeOpacity * t.opacity, r.stroke(), r.globalAlpha = e;
  } else
    r.stroke();
}
function wf(r, t, e) {
  var i = uy(t.image, t.__image, e);
  if (Ms(i)) {
    var n = r.createPattern(i, t.repeat || "repeat");
    if (typeof DOMMatrix == "function" && n && n.setTransform) {
      var a = new DOMMatrix();
      a.translateSelf(t.x || 0, t.y || 0), a.rotateSelf(0, 0, (t.rotation || 0) * Dg), a.scaleSelf(t.scaleX || 1, t.scaleY || 1), n.setTransform(a);
    }
    return n;
  }
}
function TC(r, t, e, i) {
  var n, a = ls(e), o = us(e), s = e.strokePercent, l = s < 1, u = !t.path;
  (!t.silent || l) && u && t.createPathProxy();
  var f = t.path || xC, h = t.__dirty;
  if (!i) {
    var c = e.fill, v = e.stroke, p = o && !!c.colorStops, g = a && !!v.colorStops, d = o && !!c.image, y = a && !!v.image, m = void 0, _ = void 0, S = void 0, w = void 0, b = void 0;
    (p || g) && (b = t.getBoundingRect()), p && (m = h ? bf(r, c, b) : t.__canvasFillGradient, t.__canvasFillGradient = m), g && (_ = h ? bf(r, v, b) : t.__canvasStrokeGradient, t.__canvasStrokeGradient = _), d && (S = h || !t.__canvasFillPattern ? wf(r, c, t) : t.__canvasFillPattern, t.__canvasFillPattern = S), y && (w = h || !t.__canvasStrokePattern ? wf(r, v, t) : t.__canvasStrokePattern, t.__canvasStrokePattern = S), p ? r.fillStyle = m : d && (S ? r.fillStyle = S : o = !1), g ? r.strokeStyle = _ : y && (w ? r.strokeStyle = w : a = !1);
  }
  var x = t.getGlobalScale();
  f.setScale(x[0], x[1], t.segmentIgnoreThreshold);
  var M, D;
  r.setLineDash && e.lineDash && (n = Vm(t), M = n[0], D = n[1]);
  var A = !0;
  (u || h & zi) && (f.setDPR(r.dpr), l ? f.setContext(null) : (f.setContext(r), A = !1), f.reset(), t.buildPath(f, t.shape, i), f.toStatic(), t.pathUpdated()), A && f.rebuildPath(r, l ? s : 1), M && (r.setLineDash(M), r.lineDashOffset = D), i || (e.strokeFirst ? (a && yp(r, e), o && gp(r, e)) : (o && gp(r, e), a && yp(r, e))), M && r.setLineDash([]);
}
function CC(r, t, e) {
  var i = t.__image = uy(e.image, t.__image, t, t.onload);
  if (!(!i || !Ms(i))) {
    var n = e.x || 0, a = e.y || 0, o = t.getWidth(), s = t.getHeight(), l = i.width / i.height;
    if (o == null && s != null ? o = s * l : s == null && o != null ? s = o / l : o == null && s == null && (o = i.width, s = i.height), e.sWidth && e.sHeight) {
      var u = e.sx || 0, f = e.sy || 0;
      r.drawImage(i, u, f, e.sWidth, e.sHeight, n, a, o, s);
    } else if (e.sx && e.sy) {
      var u = e.sx, f = e.sy, h = o - u, c = s - f;
      r.drawImage(i, u, f, h, c, n, a, o, s);
    } else
      r.drawImage(i, n, a, o, s);
  }
}
function MC(r, t, e) {
  var i, n = e.text;
  if (n != null && (n += ""), n) {
    r.font = e.font || vi, r.textAlign = e.textAlign, r.textBaseline = e.textBaseline;
    var a = void 0, o = void 0;
    r.setLineDash && e.lineDash && (i = Vm(t), a = i[0], o = i[1]), a && (r.setLineDash(a), r.lineDashOffset = o), e.strokeFirst ? (ls(e) && r.strokeText(n, e.x, e.y), us(e) && r.fillText(n, e.x, e.y)) : (us(e) && r.fillText(n, e.x, e.y), ls(e) && r.strokeText(n, e.x, e.y)), a && r.setLineDash([]);
  }
}
var mp = ["shadowBlur", "shadowOffsetX", "shadowOffsetY"], _p = [
  ["lineCap", "butt"],
  ["lineJoin", "miter"],
  ["miterLimit", 10]
];
function Hm(r, t, e, i, n) {
  var a = !1;
  if (!i && (e = e || {}, t === e))
    return !1;
  if (i || t.opacity !== e.opacity) {
    qt(r, n), a = !0;
    var o = Math.max(Math.min(t.opacity, 1), 0);
    r.globalAlpha = isNaN(o) ? li.opacity : o;
  }
  (i || t.blend !== e.blend) && (a || (qt(r, n), a = !0), r.globalCompositeOperation = t.blend || li.blend);
  for (var s = 0; s < mp.length; s++) {
    var l = mp[s];
    (i || t[l] !== e[l]) && (a || (qt(r, n), a = !0), r[l] = r.dpr * (t[l] || 0));
  }
  return (i || t.shadowColor !== e.shadowColor) && (a || (qt(r, n), a = !0), r.shadowColor = t.shadowColor || li.shadowColor), a;
}
function Sp(r, t, e, i, n) {
  var a = pa(t, n.inHover), o = i ? null : e && pa(e, n.inHover) || {};
  if (a === o)
    return !1;
  var s = Hm(r, a, o, i, n);
  if ((i || a.fill !== o.fill) && (s || (qt(r, n), s = !0), dp(a.fill) && (r.fillStyle = a.fill)), (i || a.stroke !== o.stroke) && (s || (qt(r, n), s = !0), dp(a.stroke) && (r.strokeStyle = a.stroke)), (i || a.opacity !== o.opacity) && (s || (qt(r, n), s = !0), r.globalAlpha = a.opacity == null ? 1 : a.opacity), t.hasStroke()) {
    var l = a.lineWidth, u = l / (a.strokeNoScale && t.getLineScale ? t.getLineScale() : 1);
    r.lineWidth !== u && (s || (qt(r, n), s = !0), r.lineWidth = u);
  }
  for (var f = 0; f < _p.length; f++) {
    var h = _p[f], c = h[0];
    (i || a[c] !== o[c]) && (s || (qt(r, n), s = !0), r[c] = a[c] || h[1]);
  }
  return s;
}
function DC(r, t, e, i, n) {
  return Hm(r, pa(t, n.inHover), e && pa(e, n.inHover), i, n);
}
function Gm(r, t) {
  var e = t.transform, i = r.dpr || 1;
  e ? r.setTransform(i * e[0], i * e[1], i * e[2], i * e[3], i * e[4], i * e[5]) : r.setTransform(i, 0, 0, i, 0, 0);
}
function AC(r, t, e) {
  for (var i = !1, n = 0; n < r.length; n++) {
    var a = r[n];
    i = i || a.isZeroArea(), Gm(t, a), t.beginPath(), a.buildPath(t, a.shape), t.clip();
  }
  e.allClipped = i;
}
function IC(r, t) {
  return r && t ? r[0] !== t[0] || r[1] !== t[1] || r[2] !== t[2] || r[3] !== t[3] || r[4] !== t[4] || r[5] !== t[5] : !(!r && !t);
}
var bp = 1, wp = 2, xp = 3, Tp = 4;
function LC(r) {
  var t = us(r), e = ls(r);
  return !(r.lineDash || !(+t ^ +e) || t && typeof r.fill != "string" || e && typeof r.stroke != "string" || r.strokePercent < 1 || r.strokeOpacity < 1 || r.fillOpacity < 1);
}
function qt(r, t) {
  t.batchFill && r.fill(), t.batchStroke && r.stroke(), t.batchFill = "", t.batchStroke = "";
}
function pa(r, t) {
  return t && r.__hoverStyle || r.style;
}
function Gh(r, t) {
  ai(r, t, { inHover: !1, viewWidth: 0, viewHeight: 0 }, !0);
}
function ai(r, t, e, i) {
  var n = t.transform;
  if (!t.shouldBePainted(e.viewWidth, e.viewHeight, !1, !1)) {
    t.__dirty &= ~te, t.__isRendered = !1;
    return;
  }
  var a = t.__clipPaths, o = e.prevElClipPaths, s = !1, l = !1;
  if ((!o || bC(a, o)) && (o && o.length && (qt(r, e), r.restore(), l = s = !0, e.prevElClipPaths = null, e.allClipped = !1, e.prevEl = null), a && a.length && (qt(r, e), r.save(), AC(a, r, e), s = !0), e.prevElClipPaths = a), e.allClipped) {
    t.__isRendered = !1;
    return;
  }
  t.beforeBrush && t.beforeBrush(), t.innerBeforeBrush();
  var u = e.prevEl;
  u || (l = s = !0);
  var f = t instanceof ot && t.autoBatch && LC(t.style);
  s || IC(n, u.transform) ? (qt(r, e), Gm(r, t)) : f || qt(r, e);
  var h = pa(t, e.inHover);
  t instanceof ot ? (e.lastDrawType !== bp && (l = !0, e.lastDrawType = bp), Sp(r, t, u, l, e), (!f || !e.batchFill && !e.batchStroke) && r.beginPath(), TC(r, t, h, f), f && (e.batchFill = h.fill || "", e.batchStroke = h.stroke || "")) : t instanceof jo ? (e.lastDrawType !== xp && (l = !0, e.lastDrawType = xp), Sp(r, t, u, l, e), MC(r, t, h)) : t instanceof ke ? (e.lastDrawType !== wp && (l = !0, e.lastDrawType = wp), DC(r, t, u, l, e), CC(r, t, h)) : t.getTemporalDisplayables && (e.lastDrawType !== Tp && (l = !0, e.lastDrawType = Tp), PC(r, t, e)), f && i && qt(r, e), t.innerAfterBrush(), t.afterBrush && t.afterBrush(), e.prevEl = t, t.__dirty = 0, t.__isRendered = !0;
}
function PC(r, t, e) {
  var i = t.getDisplayables(), n = t.getTemporalDisplayables();
  r.save();
  var a = {
    prevElClipPaths: null,
    prevEl: null,
    allClipped: !1,
    viewWidth: e.viewWidth,
    viewHeight: e.viewHeight,
    inHover: e.inHover
  }, o, s;
  for (o = t.getCursor(), s = i.length; o < s; o++) {
    var l = i[o];
    l.beforeBrush && l.beforeBrush(), l.innerBeforeBrush(), ai(r, l, a, o === s - 1), l.innerAfterBrush(), l.afterBrush && l.afterBrush(), a.prevEl = l;
  }
  for (var u = 0, f = n.length; u < f; u++) {
    var l = n[u];
    l.beforeBrush && l.beforeBrush(), l.innerBeforeBrush(), ai(r, l, a, u === f - 1), l.innerAfterBrush(), l.afterBrush && l.afterBrush(), a.prevEl = l;
  }
  t.clearTemporalDisplayables(), t.notClear = !0, r.restore();
}
var ql = new fC(), Cp = new xa(100), Mp = ["symbol", "symbolSize", "symbolKeepAspect", "color", "backgroundColor", "dashArrayX", "dashArrayY", "maxTileWidth", "maxTileHeight"];
function xf(r, t) {
  if (r === "none")
    return null;
  var e = t.getDevicePixelRatio(), i = t.getZr(), n = i.painter.type === "svg";
  r.dirty && ql.delete(r);
  var a = ql.get(r);
  if (a)
    return a;
  var o = at(r, {
    symbol: "rect",
    symbolSize: 1,
    symbolKeepAspect: !0,
    color: "rgba(0, 0, 0, 0.2)",
    backgroundColor: null,
    dashArrayX: 5,
    dashArrayY: 5,
    rotation: 0,
    maxTileWidth: 512,
    maxTileHeight: 512
  });
  o.backgroundColor === "none" && (o.backgroundColor = null);
  var s = {
    repeat: "repeat"
  };
  return l(s), s.rotation = o.rotation, s.scaleX = s.scaleY = n ? 1 : 1 / e, ql.set(r, s), r.dirty = !1, s;
  function l(u) {
    for (var f = [e], h = !0, c = 0; c < Mp.length; ++c) {
      var v = o[Mp[c]];
      if (v != null && !O(v) && !V(v) && !vt(v) && typeof v != "boolean") {
        h = !1;
        break;
      }
      f.push(v);
    }
    var p;
    if (h) {
      p = f.join(",") + (n ? "-svg" : "");
      var g = Cp.get(p);
      g && (n ? u.svgElement = g : u.image = g);
    }
    var d = Um(o.dashArrayX), y = RC(o.dashArrayY), m = Wm(o.symbol), _ = EC(d), S = Ym(y), w = !n && Re.createCanvas(), b = n && {
      tag: "g",
      attrs: {},
      key: "dcl",
      children: []
    }, x = D(), M;
    w && (w.width = x.width * e, w.height = x.height * e, M = w.getContext("2d")), A(), h && Cp.put(p, w || b), u.image = w, u.svgElement = b, u.svgWidth = x.width, u.svgHeight = x.height;
    function D() {
      for (var C = 1, I = 0, L = _.length; I < L; ++I)
        C = Fv(C, _[I]);
      for (var P = 1, I = 0, L = m.length; I < L; ++I)
        P = Fv(P, m[I].length);
      C *= P;
      var R = S * _.length * m.length;
      return {
        width: Math.max(1, Math.min(C, o.maxTileWidth)),
        height: Math.max(1, Math.min(R, o.maxTileHeight))
      };
    }
    function A() {
      M && (M.clearRect(0, 0, w.width, w.height), o.backgroundColor && (M.fillStyle = o.backgroundColor, M.fillRect(0, 0, w.width, w.height)));
      for (var C = 0, I = 0; I < y.length; ++I)
        C += y[I];
      if (C <= 0)
        return;
      for (var L = -S, P = 0, R = 0, E = 0; L < x.height; ) {
        if (P % 2 === 0) {
          for (var G = R / 2 % m.length, N = 0, B = 0, W = 0; N < x.width * 2; ) {
            for (var K = 0, I = 0; I < d[E].length; ++I)
              K += d[E][I];
            if (K <= 0)
              break;
            if (B % 2 === 0) {
              var tt = (1 - o.symbolSize) * 0.5, lt = N + d[E][B] * tt, yt = L + y[P] * tt, _t = d[E][B] * o.symbolSize, Se = y[P] * o.symbolSize, Pr = W / 2 % m[G].length;
              Si(lt, yt, _t, Se, m[G][Pr]);
            }
            N += d[E][B], ++W, ++B, B === d[E].length && (B = 0);
          }
          ++E, E === d.length && (E = 0);
        }
        L += y[P], ++R, ++P, P === y.length && (P = 0);
      }
      function Si(Jt, Tt, $, et, Rr) {
        var Nt = n ? 1 : e, hv = ge(Rr, Jt * Nt, Tt * Nt, $ * Nt, et * Nt, o.color, o.symbolKeepAspect);
        if (n) {
          var vv = i.painter.renderOneToVNode(hv);
          vv && b.children.push(vv);
        } else
          Gh(M, hv);
      }
    }
  }
}
function Wm(r) {
  if (!r || r.length === 0)
    return [["rect"]];
  if (V(r))
    return [[r]];
  for (var t = !0, e = 0; e < r.length; ++e)
    if (!V(r[e])) {
      t = !1;
      break;
    }
  if (t)
    return Wm([r]);
  for (var i = [], e = 0; e < r.length; ++e)
    V(r[e]) ? i.push([r[e]]) : i.push(r[e]);
  return i;
}
function Um(r) {
  if (!r || r.length === 0)
    return [[0, 0]];
  if (vt(r)) {
    var t = Math.ceil(r);
    return [[t, t]];
  }
  for (var e = !0, i = 0; i < r.length; ++i)
    if (!vt(r[i])) {
      e = !1;
      break;
    }
  if (e)
    return Um([r]);
  for (var n = [], i = 0; i < r.length; ++i)
    if (vt(r[i])) {
      var t = Math.ceil(r[i]);
      n.push([t, t]);
    } else {
      var t = z(r[i], function(s) {
        return Math.ceil(s);
      });
      t.length % 2 === 1 ? n.push(t.concat(t)) : n.push(t);
    }
  return n;
}
function RC(r) {
  if (!r || typeof r == "object" && r.length === 0)
    return [0, 0];
  if (vt(r)) {
    var t = Math.ceil(r);
    return [t, t];
  }
  var e = z(r, function(i) {
    return Math.ceil(i);
  });
  return r.length % 2 ? e.concat(e) : e;
}
function EC(r) {
  return z(r, function(t) {
    return Ym(t);
  });
}
function Ym(r) {
  for (var t = 0, e = 0; e < r.length; ++e)
    t += r[e];
  return r.length % 2 === 1 ? t * 2 : t;
}
function OC(r, t) {
  r.eachRawSeries(function(e) {
    if (!r.isSeriesFiltered(e)) {
      var i = e.getData();
      i.hasItemVisual() && i.each(function(o) {
        var s = i.getItemVisual(o, "decal");
        if (s) {
          var l = i.ensureUniqueItemVisual(o, "style");
          l.decal = xf(s, t);
        }
      });
      var n = i.getVisual("decal");
      if (n) {
        var a = i.getVisual("style");
        a.decal = xf(n, t);
      }
    }
  });
}
var Ce = new $e(), Xm = {};
function kC(r, t) {
  Xm[r] = t;
}
function $m(r) {
  return Xm[r];
}
var NC = "5.6.0", BC = {
  zrender: "5.6.1"
}, zC = 1, FC = 800, VC = 900, HC = 1e3, GC = 2e3, WC = 5e3, Zm = 1e3, UC = 1100, Wh = 2e3, qm = 3e3, YC = 4e3, Qs = 4500, XC = 4600, $C = 5e3, ZC = 6e3, Km = 7e3, Qm = {
  PROCESSOR: {
    FILTER: HC,
    SERIES_FILTER: FC,
    STATISTIC: WC
  },
  VISUAL: {
    LAYOUT: Zm,
    PROGRESSIVE_LAYOUT: UC,
    GLOBAL: Wh,
    CHART: qm,
    POST_CHART_LAYOUT: XC,
    COMPONENT: YC,
    BRUSH: $C,
    CHART_ITEM: Qs,
    ARIA: ZC,
    DECAL: Km
  }
}, It = "__flagInMainProcess", Xt = "__pendingUpdate", Kl = "__needsUpdateStatus", Dp = /^[a-zA-Z0-9_]+$/, Ql = "__connectUpdateStatus", Ap = 0, qC = 1, KC = 2;
function Jm(r) {
  return function() {
    for (var t = [], e = 0; e < arguments.length; e++)
      t[e] = arguments[e];
    if (this.isDisposed()) {
      this.id;
      return;
    }
    return t0(this, r, t);
  };
}
function jm(r) {
  return function() {
    for (var t = [], e = 0; e < arguments.length; e++)
      t[e] = arguments[e];
    return t0(this, r, t);
  };
}
function t0(r, t, e) {
  return e[0] = e[0] && e[0].toLowerCase(), $e.prototype[t].apply(r, e);
}
var e0 = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      return r !== null && r.apply(this, arguments) || this;
    }
    return t;
  })($e)
), r0 = e0.prototype;
r0.on = jm("on");
r0.off = jm("off");
var Ei, Jl, lo, lr, jl, tu, eu, bn, wn, Ip, Lp, ru, Pp, uo, Rp, i0, ne, Ep, fs = (
  /** @class */
  (function(r) {
    F(t, r);
    function t(e, i, n) {
      var a = r.call(this, new iC()) || this;
      a._chartsViews = [], a._chartsMap = {}, a._componentsViews = [], a._componentsMap = {}, a._pendingActions = [], n = n || {}, V(i) && (i = n0[i]), a._dom = e;
      var o = "canvas", s = "auto", l = !1;
      n.ssr && Kg(function(c) {
        var v = J(c), p = v.dataIndex;
        if (p != null) {
          var g = q();
          return g.set("series_index", v.seriesIndex), g.set("data_index", p), v.ssrType && g.set("ssr_type", v.ssrType), g;
        }
      });
      var u = a._zr = Ku(e, {
        renderer: n.renderer || o,
        devicePixelRatio: n.devicePixelRatio,
        width: n.width,
        height: n.height,
        ssr: n.ssr,
        useDirtyRect: Z(n.useDirtyRect, l),
        useCoarsePointer: Z(n.useCoarsePointer, s),
        pointerSize: n.pointerSize
      });
      a._ssr = n.ssr, a._throttledZrFlush = qs(Q(u.flush, u), 17), i = U(i), i && cm(i, !0), a._theme = i, a._locale = sx(n.locale || qy), a._coordSysMgr = new Ra();
      var f = a._api = Rp(a);
      function h(c, v) {
        return c.__prio - v.__prio;
      }
      return Ao(vs, h), Ao(Tf, h), a._scheduler = new Om(a, f, Tf, vs), a._messageCenter = new e0(), a._initEvents(), a.resize = Q(a.resize, a), u.animation.on("frame", a._onframe, a), Ip(u, a), Lp(u, a), Wo(a), a;
    }
    return t.prototype._onframe = function() {
      if (!this._disposed) {
        Ep(this);
        var e = this._scheduler;
        if (this[Xt]) {
          var i = this[Xt].silent;
          this[It] = !0;
          try {
            Ei(this), lr.update.call(this, null, this[Xt].updateParams);
          } catch (l) {
            throw this[It] = !1, this[Xt] = null, l;
          }
          this._zr.flush(), this[It] = !1, this[Xt] = null, bn.call(this, i), wn.call(this, i);
        } else if (e.unfinished) {
          var n = zC, a = this._model, o = this._api;
          e.unfinished = !1;
          do {
            var s = +/* @__PURE__ */ new Date();
            e.performSeriesTasks(a), e.performDataProcessorTasks(a), tu(this, a), e.performVisualTasks(a), uo(this, this._model, o, "remain", {}), n -= +/* @__PURE__ */ new Date() - s;
          } while (n > 0 && e.unfinished);
          e.unfinished || this._zr.flush();
        }
      }
    }, t.prototype.getDom = function() {
      return this._dom;
    }, t.prototype.getId = function() {
      return this.id;
    }, t.prototype.getZr = function() {
      return this._zr;
    }, t.prototype.isSSR = function() {
      return this._ssr;
    }, t.prototype.setOption = function(e, i, n) {
      if (!this[It]) {
        if (this._disposed) {
          this.id;
          return;
        }
        var a, o, s;
        if (H(i) && (n = i.lazyUpdate, a = i.silent, o = i.replaceMerge, s = i.transition, i = i.notMerge), this[It] = !0, !this._model || i) {
          var l = new zx(this._api), u = this._theme, f = this._model = new Oh();
          f.scheduler = this._scheduler, f.ssr = this._ssr, f.init(null, null, null, u, this._locale, l);
        }
        this._model.setOption(e, {
          replaceMerge: o
        }, Cf);
        var h = {
          seriesTransition: s,
          optionChanged: !0
        };
        if (n)
          this[Xt] = {
            silent: a,
            updateParams: h
          }, this[It] = !1, this.getZr().wakeUp();
        else {
          try {
            Ei(this), lr.update.call(this, null, h);
          } catch (c) {
            throw this[Xt] = null, this[It] = !1, c;
          }
          this._ssr || this._zr.flush(), this[Xt] = null, this[It] = !1, bn.call(this, a), wn.call(this, a);
        }
      }
    }, t.prototype.setTheme = function() {
    }, t.prototype.getModel = function() {
      return this._model;
    }, t.prototype.getOption = function() {
      return this._model && this._model.getOption();
    }, t.prototype.getWidth = function() {
      return this._zr.getWidth();
    }, t.prototype.getHeight = function() {
      return this._zr.getHeight();
    }, t.prototype.getDevicePixelRatio = function() {
      return this._zr.painter.dpr || Y.hasGlobalWindow && window.devicePixelRatio || 1;
    }, t.prototype.getRenderedCanvas = function(e) {
      return this.renderToCanvas(e);
    }, t.prototype.renderToCanvas = function(e) {
      e = e || {};
      var i = this._zr.painter;
      return i.getRenderedCanvas({
        backgroundColor: e.backgroundColor || this._model.get("backgroundColor"),
        pixelRatio: e.pixelRatio || this.getDevicePixelRatio()
      });
    }, t.prototype.renderToSVGString = function(e) {
      e = e || {};
      var i = this._zr.painter;
      return i.renderToString({
        useViewBox: e.useViewBox
      });
    }, t.prototype.getSvgDataURL = function() {
      if (Y.svgSupported) {
        var e = this._zr, i = e.storage.getDisplayList();
        return T(i, function(n) {
          n.stopAnimation(null, !0);
        }), e.painter.toDataURL();
      }
    }, t.prototype.getDataURL = function(e) {
      if (this._disposed) {
        this.id;
        return;
      }
      e = e || {};
      var i = e.excludeComponents, n = this._model, a = [], o = this;
      T(i, function(l) {
        n.eachComponent({
          mainType: l
        }, function(u) {
          var f = o._componentsMap[u.__viewId];
          f.group.ignore || (a.push(f), f.group.ignore = !0);
        });
      });
      var s = this._zr.painter.getType() === "svg" ? this.getSvgDataURL() : this.renderToCanvas(e).toDataURL("image/" + (e && e.type || "png"));
      return T(a, function(l) {
        l.group.ignore = !1;
      }), s;
    }, t.prototype.getConnectedDataURL = function(e) {
      if (this._disposed) {
        this.id;
        return;
      }
      var i = e.type === "svg", n = this.group, a = Math.min, o = Math.max, s = 1 / 0;
      if (cs[n]) {
        var l = s, u = s, f = -s, h = -s, c = [], v = e && e.pixelRatio || this.getDevicePixelRatio();
        T(fi, function(_, S) {
          if (_.group === n) {
            var w = i ? _.getZr().painter.getSvgDom().innerHTML : _.renderToCanvas(U(e)), b = _.getDom().getBoundingClientRect();
            l = a(b.left, l), u = a(b.top, u), f = o(b.right, f), h = o(b.bottom, h), c.push({
              dom: w,
              left: b.left,
              top: b.top
            });
          }
        }), l *= v, u *= v, f *= v, h *= v;
        var p = f - l, g = h - u, d = Re.createCanvas(), y = Ku(d, {
          renderer: i ? "svg" : "canvas"
        });
        if (y.resize({
          width: p,
          height: g
        }), i) {
          var m = "";
          return T(c, function(_) {
            var S = _.left - l, w = _.top - u;
            m += '<g transform="translate(' + S + "," + w + ')">' + _.dom + "</g>";
          }), y.painter.getSvgRoot().innerHTML = m, e.connectedBackgroundColor && y.painter.setBackgroundColor(e.connectedBackgroundColor), y.refreshImmediately(), y.painter.toDataURL();
        } else
          return e.connectedBackgroundColor && y.add(new dt({
            shape: {
              x: 0,
              y: 0,
              width: p,
              height: g
            },
            style: {
              fill: e.connectedBackgroundColor
            }
          })), T(c, function(_) {
            var S = new ke({
              style: {
                x: _.left * v - l,
                y: _.top * v - u,
                image: _.dom
              }
            });
            y.add(S);
          }), y.refreshImmediately(), d.toDataURL("image/" + (e && e.type || "png"));
      } else
        return this.getDataURL(e);
    }, t.prototype.convertToPixel = function(e, i) {
      return jl(this, "convertToPixel", e, i);
    }, t.prototype.convertFromPixel = function(e, i) {
      return jl(this, "convertFromPixel", e, i);
    }, t.prototype.containPixel = function(e, i) {
      if (this._disposed) {
        this.id;
        return;
      }
      var n = this._model, a, o = wl(n, e);
      return T(o, function(s, l) {
        l.indexOf("Models") >= 0 && T(s, function(u) {
          var f = u.coordinateSystem;
          if (f && f.containPoint)
            a = a || !!f.containPoint(i);
          else if (l === "seriesModels") {
            var h = this._chartsMap[u.__viewId];
            h && h.containPoint && (a = a || h.containPoint(i, u));
          }
        }, this);
      }, this), !!a;
    }, t.prototype.getVisual = function(e, i) {
      var n = this._model, a = wl(n, e, {
        defaultMainType: "series"
      }), o = a.seriesModel, s = o.getData(), l = a.hasOwnProperty("dataIndexInside") ? a.dataIndexInside : a.hasOwnProperty("dataIndex") ? s.indexOfRawIndex(a.dataIndex) : null;
      return l != null ? Fm(s, l, i) : Vh(s, i);
    }, t.prototype.getViewOfComponentModel = function(e) {
      return this._componentsMap[e.__viewId];
    }, t.prototype.getViewOfSeriesModel = function(e) {
      return this._chartsMap[e.__viewId];
    }, t.prototype._initEvents = function() {
      var e = this;
      T(QC, function(i) {
        var n = function(a) {
          var o = e.getModel(), s = a.target, l, u = i === "globalout";
          if (u ? l = {} : s && Gi(s, function(p) {
            var g = J(p);
            if (g && g.dataIndex != null) {
              var d = g.dataModel || o.getSeriesByIndex(g.seriesIndex);
              return l = d && d.getDataParams(g.dataIndex, g.dataType, s) || {}, !0;
            } else if (g.eventData)
              return l = k({}, g.eventData), !0;
          }, !0), l) {
            var f = l.componentType, h = l.componentIndex;
            (f === "markLine" || f === "markPoint" || f === "markArea") && (f = "series", h = l.seriesIndex);
            var c = f && h != null && o.getComponent(f, h), v = c && e[c.mainType === "series" ? "_chartsMap" : "_componentsMap"][c.__viewId];
            l.event = a, l.type = i, e._$eventProcessor.eventInfo = {
              targetEl: s,
              packedEvent: l,
              model: c,
              view: v
            }, e.trigger(i, l);
          }
        };
        n.zrEventfulCallAtLast = !0, e._zr.on(i, n, e);
      }), T(qn, function(i, n) {
        e._messageCenter.on(n, function(a) {
          this.trigger(n, a);
        }, e);
      }), T(["selectchanged"], function(i) {
        e._messageCenter.on(i, function(n) {
          this.trigger(i, n);
        }, e);
      }), sC(this._messageCenter, this, this._api);
    }, t.prototype.isDisposed = function() {
      return this._disposed;
    }, t.prototype.clear = function() {
      if (this._disposed) {
        this.id;
        return;
      }
      this.setOption({
        series: []
      }, !0);
    }, t.prototype.dispose = function() {
      if (this._disposed) {
        this.id;
        return;
      }
      this._disposed = !0;
      var e = this.getDom();
      e && oy(this.getDom(), Yh, "");
      var i = this, n = i._api, a = i._model;
      T(i._componentsViews, function(o) {
        o.dispose(a, n);
      }), T(i._chartsViews, function(o) {
        o.dispose(a, n);
      }), i._zr.dispose(), i._dom = i._model = i._chartsMap = i._componentsMap = i._chartsViews = i._componentsViews = i._scheduler = i._api = i._zr = i._throttledZrFlush = i._theme = i._coordSysMgr = i._messageCenter = null, delete fi[i.id];
    }, t.prototype.resize = function(e) {
      if (!this[It]) {
        if (this._disposed) {
          this.id;
          return;
        }
        this._zr.resize(e);
        var i = this._model;
        if (this._loadingFX && this._loadingFX.resize(), !!i) {
          var n = i.resetOption("media"), a = e && e.silent;
          this[Xt] && (a == null && (a = this[Xt].silent), n = !0, this[Xt] = null), this[It] = !0;
          try {
            n && Ei(this), lr.update.call(this, {
              type: "resize",
              animation: k({
                // Disable animation
                duration: 0
              }, e && e.animation)
            });
          } catch (o) {
            throw this[It] = !1, o;
          }
          this[It] = !1, bn.call(this, a), wn.call(this, a);
        }
      }
    }, t.prototype.showLoading = function(e, i) {
      if (this._disposed) {
        this.id;
        return;
      }
      if (H(e) && (i = e, e = ""), e = e || "default", this.hideLoading(), !!Mf[e]) {
        var n = Mf[e](this._api, i), a = this._zr;
        this._loadingFX = n, a.add(n);
      }
    }, t.prototype.hideLoading = function() {
      if (this._disposed) {
        this.id;
        return;
      }
      this._loadingFX && this._zr.remove(this._loadingFX), this._loadingFX = null;
    }, t.prototype.makeActionFromEvent = function(e) {
      var i = k({}, e);
      return i.type = qn[e.type], i;
    }, t.prototype.dispatchAction = function(e, i) {
      if (this._disposed) {
        this.id;
        return;
      }
      if (H(i) || (i = {
        silent: !!i
      }), !!hs[e.type] && this._model) {
        if (this[It]) {
          this._pendingActions.push(e);
          return;
        }
        var n = i.silent;
        eu.call(this, e, n);
        var a = i.flush;
        a ? this._zr.flush() : a !== !1 && Y.browser.weChat && this._throttledZrFlush(), bn.call(this, n), wn.call(this, n);
      }
    }, t.prototype.updateLabelLayout = function() {
      Ce.trigger("series:layoutlabels", this._model, this._api, {
        // Not adding series labels.
        // TODO
        updatedSeries: []
      });
    }, t.prototype.appendData = function(e) {
      if (this._disposed) {
        this.id;
        return;
      }
      var i = e.seriesIndex, n = this.getModel(), a = n.getSeriesByIndex(i);
      a.appendData(e), this._scheduler.unfinished = !0, this.getZr().wakeUp();
    }, t.internalField = (function() {
      Ei = function(h) {
        var c = h._scheduler;
        c.restorePipelines(h._model), c.prepareStageTasks(), Jl(h, !0), Jl(h, !1), c.plan();
      }, Jl = function(h, c) {
        for (var v = h._model, p = h._scheduler, g = c ? h._componentsViews : h._chartsViews, d = c ? h._componentsMap : h._chartsMap, y = h._zr, m = h._api, _ = 0; _ < g.length; _++)
          g[_].__alive = !1;
        c ? v.eachComponent(function(b, x) {
          b !== "series" && S(x);
        }) : v.eachSeries(S);
        function S(b) {
          var x = b.__requireNewView;
          b.__requireNewView = !1;
          var M = "_ec_" + b.id + "_" + b.type, D = !x && d[M];
          if (!D) {
            var A = Ge(b.type), C = c ? kt.getClass(A.main, A.sub) : (
              // FIXME:TS
              // (ChartView as ChartViewConstructor).getClass('series', classType.sub)
              // For backward compat, still support a chart type declared as only subType
              // like "liquidfill", but recommend "series.liquidfill"
              // But need a base class to make a type series.
              Et.getClass(A.sub)
            );
            D = new C(), D.init(v, m), d[M] = D, g.push(D), y.add(D.group);
          }
          b.__viewId = D.__id = M, D.__alive = !0, D.__model = b, D.group.__ecComponentInfo = {
            mainType: b.mainType,
            index: b.componentIndex
          }, !c && p.prepareView(D, b, v, m);
        }
        for (var _ = 0; _ < g.length; ) {
          var w = g[_];
          w.__alive ? _++ : (!c && w.renderTask.dispose(), y.remove(w.group), w.dispose(v, m), g.splice(_, 1), d[w.__id] === w && delete d[w.__id], w.__id = w.group.__ecComponentInfo = null);
        }
      }, lo = function(h, c, v, p, g) {
        var d = h._model;
        if (d.setUpdatePayload(v), !p) {
          T([].concat(h._componentsViews).concat(h._chartsViews), w);
          return;
        }
        var y = {};
        y[p + "Id"] = v[p + "Id"], y[p + "Index"] = v[p + "Index"], y[p + "Name"] = v[p + "Name"];
        var m = {
          mainType: p,
          query: y
        };
        g && (m.subType = g);
        var _ = v.excludeSeriesId, S;
        _ != null && (S = q(), T(Dt(_), function(b) {
          var x = Pe(b, null);
          x != null && S.set(x, !0);
        })), d && d.eachComponent(m, function(b) {
          var x = S && S.get(b.id) != null;
          if (!x)
            if (cc(v))
              if (b instanceof Ut)
                v.type === ui && !v.notBlur && !b.get(["emphasis", "disabled"]) && ew(b, v, h._api);
              else {
                var M = mh(b.mainType, b.componentIndex, v.name, h._api), D = M.focusSelf, A = M.dispatchers;
                v.type === ui && D && !v.notBlur && af(b.mainType, b.componentIndex, h._api), A && T(A, function(C) {
                  v.type === ui ? sa(C) : la(C);
                });
              }
            else lf(v) && b instanceof Ut && (nw(b, v, h._api), hc(b), ne(h));
        }, h), d && d.eachComponent(m, function(b) {
          var x = S && S.get(b.id) != null;
          x || w(h[p === "series" ? "_chartsMap" : "_componentsMap"][b.__viewId]);
        }, h);
        function w(b) {
          b && b.__alive && b[c] && b[c](b.__model, d, h._api, v);
        }
      }, lr = {
        prepareAndUpdate: function(h) {
          Ei(this), lr.update.call(this, h, {
            // Needs to mark option changed if newOption is given.
            // It's from MagicType.
            // TODO If use a separate flag optionChanged in payload?
            optionChanged: h.newOption != null
          });
        },
        update: function(h, c) {
          var v = this._model, p = this._api, g = this._zr, d = this._coordSysMgr, y = this._scheduler;
          if (v) {
            v.setUpdatePayload(h), y.restoreData(v, h), y.performSeriesTasks(v), d.create(v, p), y.performDataProcessorTasks(v, h), tu(this, v), d.update(v, p), e(v), y.performVisualTasks(v, h), ru(this, v, p, h, c);
            var m = v.get("backgroundColor") || "transparent", _ = v.get("darkMode");
            g.setBackgroundColor(m), _ != null && _ !== "auto" && g.setDarkMode(_), Ce.trigger("afterupdate", v, p);
          }
        },
        updateTransform: function(h) {
          var c = this, v = this._model, p = this._api;
          if (v) {
            v.setUpdatePayload(h);
            var g = [];
            v.eachComponent(function(y, m) {
              if (y !== "series") {
                var _ = c.getViewOfComponentModel(m);
                if (_ && _.__alive)
                  if (_.updateTransform) {
                    var S = _.updateTransform(m, v, p, h);
                    S && S.update && g.push(_);
                  } else
                    g.push(_);
              }
            });
            var d = q();
            v.eachSeries(function(y) {
              var m = c._chartsMap[y.__viewId];
              if (m.updateTransform) {
                var _ = m.updateTransform(y, v, p, h);
                _ && _.update && d.set(y.uid, 1);
              } else
                d.set(y.uid, 1);
            }), e(v), this._scheduler.performVisualTasks(v, h, {
              setDirty: !0,
              dirtyMap: d
            }), uo(this, v, p, h, {}, d), Ce.trigger("afterupdate", v, p);
          }
        },
        updateView: function(h) {
          var c = this._model;
          c && (c.setUpdatePayload(h), Et.markUpdateMethod(h, "updateView"), e(c), this._scheduler.performVisualTasks(c, h, {
            setDirty: !0
          }), ru(this, c, this._api, h, {}), Ce.trigger("afterupdate", c, this._api));
        },
        updateVisual: function(h) {
          var c = this, v = this._model;
          v && (v.setUpdatePayload(h), v.eachSeries(function(p) {
            p.getData().clearAllVisual();
          }), Et.markUpdateMethod(h, "updateVisual"), e(v), this._scheduler.performVisualTasks(v, h, {
            visualType: "visual",
            setDirty: !0
          }), v.eachComponent(function(p, g) {
            if (p !== "series") {
              var d = c.getViewOfComponentModel(g);
              d && d.__alive && d.updateVisual(g, v, c._api, h);
            }
          }), v.eachSeries(function(p) {
            var g = c._chartsMap[p.__viewId];
            g.updateVisual(p, v, c._api, h);
          }), Ce.trigger("afterupdate", v, this._api));
        },
        updateLayout: function(h) {
          lr.update.call(this, h);
        }
      }, jl = function(h, c, v, p) {
        if (h._disposed) {
          h.id;
          return;
        }
        for (var g = h._model, d = h._coordSysMgr.getCoordinateSystems(), y, m = wl(g, v), _ = 0; _ < d.length; _++) {
          var S = d[_];
          if (S[c] && (y = S[c](g, m, p)) != null)
            return y;
        }
      }, tu = function(h, c) {
        var v = h._chartsMap, p = h._scheduler;
        c.eachSeries(function(g) {
          p.updateStreamModes(g, v[g.__viewId]);
        });
      }, eu = function(h, c) {
        var v = this, p = this.getModel(), g = h.type, d = h.escapeConnect, y = hs[g], m = y.actionInfo, _ = (m.update || "update").split(":"), S = _.pop(), w = _[0] != null && Ge(_[0]);
        this[It] = !0;
        var b = [h], x = !1;
        h.batch && (x = !0, b = z(h.batch, function(P) {
          return P = at(k({}, P), h), P.batch = null, P;
        }));
        var M = [], D, A = lf(h), C = cc(h);
        if (C && My(this._api), T(b, function(P) {
          if (D = y.action(P, v._model, v._api), D = D || k({}, P), D.type = m.event || D.type, M.push(D), C) {
            var R = vh(h), E = R.queryOptionMap, G = R.mainTypeSpecified, N = G ? E.keys()[0] : "series";
            lo(v, S, P, N), ne(v);
          } else A ? (lo(v, S, P, "series"), ne(v)) : w && lo(v, S, P, w.main, w.sub);
        }), S !== "none" && !C && !A && !w)
          try {
            this[Xt] ? (Ei(this), lr.update.call(this, h), this[Xt] = null) : lr[S].call(this, h);
          } catch (P) {
            throw this[It] = !1, P;
          }
        if (x ? D = {
          type: m.event || g,
          escapeConnect: d,
          batch: M
        } : D = M[0], this[It] = !1, !c) {
          var I = this._messageCenter;
          if (I.trigger(D.type, D), A) {
            var L = {
              type: "selectchanged",
              escapeConnect: d,
              selected: aw(p),
              isFromClick: h.isFromClick || !1,
              fromAction: h.type,
              fromActionPayload: h
            };
            I.trigger(L.type, L);
          }
        }
      }, bn = function(h) {
        for (var c = this._pendingActions; c.length; ) {
          var v = c.shift();
          eu.call(this, v, h);
        }
      }, wn = function(h) {
        !h && this.trigger("updated");
      }, Ip = function(h, c) {
        h.on("rendered", function(v) {
          c.trigger("rendered", v), // Although zr is dirty if initial animation is not finished
          // and this checking is called on frame, we also check
          // animation finished for robustness.
          h.animation.isFinished() && !c[Xt] && !c._scheduler.unfinished && !c._pendingActions.length && c.trigger("finished");
        });
      }, Lp = function(h, c) {
        h.on("mouseover", function(v) {
          var p = v.target, g = Gi(p, sf);
          g && (rw(g, v, c._api), ne(c));
        }).on("mouseout", function(v) {
          var p = v.target, g = Gi(p, sf);
          g && (iw(g, v, c._api), ne(c));
        }).on("click", function(v) {
          var p = v.target, g = Gi(p, function(m) {
            return J(m).dataIndex != null;
          }, !0);
          if (g) {
            var d = g.selected ? "unselect" : "select", y = J(g);
            c._api.dispatchAction({
              type: d,
              dataType: y.dataType,
              dataIndexInside: y.dataIndex,
              seriesIndex: y.seriesIndex,
              isFromClick: !0
            });
          }
        });
      };
      function e(h) {
        h.clearColorPalette(), h.eachSeries(function(c) {
          c.clearColorPalette();
        });
      }
      function i(h) {
        var c = [], v = [], p = !1;
        if (h.eachComponent(function(m, _) {
          var S = _.get("zlevel") || 0, w = _.get("z") || 0, b = _.getZLevelKey();
          p = p || !!b, (m === "series" ? v : c).push({
            zlevel: S,
            z: w,
            idx: _.componentIndex,
            type: m,
            key: b
          });
        }), p) {
          var g = c.concat(v), d, y;
          Ao(g, function(m, _) {
            return m.zlevel === _.zlevel ? m.z - _.z : m.zlevel - _.zlevel;
          }), T(g, function(m) {
            var _ = h.getComponent(m.type, m.idx), S = m.zlevel, w = m.key;
            d != null && (S = Math.max(d, S)), w ? (S === d && w !== y && S++, y = w) : y && (S === d && S++, y = ""), d = S, _.setZLevel(S);
          });
        }
      }
      ru = function(h, c, v, p, g) {
        i(c), Pp(h, c, v, p, g), T(h._chartsViews, function(d) {
          d.__alive = !1;
        }), uo(h, c, v, p, g), T(h._chartsViews, function(d) {
          d.__alive || d.remove(c, v);
        });
      }, Pp = function(h, c, v, p, g, d) {
        T(d || h._componentsViews, function(y) {
          var m = y.__model;
          u(m, y), y.render(m, c, v, p), s(m, y), f(m, y);
        });
      }, uo = function(h, c, v, p, g, d) {
        var y = h._scheduler;
        g = k(g || {}, {
          updatedSeries: c.getSeries()
        }), Ce.trigger("series:beforeupdate", c, v, g);
        var m = !1;
        c.eachSeries(function(_) {
          var S = h._chartsMap[_.__viewId];
          S.__alive = !0;
          var w = S.renderTask;
          y.updatePayload(w, p), u(_, S), d && d.get(_.uid) && w.dirty(), w.perform(y.getPerformArgs(w)) && (m = !0), S.group.silent = !!_.get("silent"), o(_, S), hc(_);
        }), y.unfinished = m || y.unfinished, Ce.trigger("series:layoutlabels", c, v, g), Ce.trigger("series:transition", c, v, g), c.eachSeries(function(_) {
          var S = h._chartsMap[_.__viewId];
          s(_, S), f(_, S);
        }), a(h, c), Ce.trigger("series:afterupdate", c, v, g);
      }, ne = function(h) {
        h[Kl] = !0, h.getZr().wakeUp();
      }, Ep = function(h) {
        h[Kl] && (h.getZr().storage.traverse(function(c) {
          Yn(c) || n(c);
        }), h[Kl] = !1);
      };
      function n(h) {
        for (var c = [], v = h.currentStates, p = 0; p < v.length; p++) {
          var g = v[p];
          g === "emphasis" || g === "blur" || g === "select" || c.push(g);
        }
        h.selected && h.states.select && c.push("select"), h.hoverState === Is && h.states.emphasis ? c.push("emphasis") : h.hoverState === As && h.states.blur && c.push("blur"), h.useStates(c);
      }
      function a(h, c) {
        var v = h._zr, p = v.storage, g = 0;
        p.traverse(function(d) {
          d.isGroup || g++;
        }), g > c.get("hoverLayerThreshold") && !Y.node && !Y.worker && c.eachSeries(function(d) {
          if (!d.preventUsingHoverLayer) {
            var y = h._chartsMap[d.__viewId];
            y.__alive && y.eachRendered(function(m) {
              m.states.emphasis && (m.states.emphasis.hoverLayer = !0);
            });
          }
        });
      }
      function o(h, c) {
        var v = h.get("blendMode") || null;
        c.eachRendered(function(p) {
          p.isGroup || (p.style.blend = v);
        });
      }
      function s(h, c) {
        if (!h.preventAutoZ) {
          var v = h.get("z") || 0, p = h.get("zlevel") || 0;
          c.eachRendered(function(g) {
            return l(g, v, p, -1 / 0), !0;
          });
        }
      }
      function l(h, c, v, p) {
        var g = h.getTextContent(), d = h.getTextGuideLine(), y = h.isGroup;
        if (y)
          for (var m = h.childrenRef(), _ = 0; _ < m.length; _++)
            p = Math.max(l(m[_], c, v, p), p);
        else
          h.z = c, h.zlevel = v, p = Math.max(h.z2, p);
        if (g && (g.z = c, g.zlevel = v, isFinite(p) && (g.z2 = p + 2)), d) {
          var S = h.textGuideLineConfig;
          d.z = c, d.zlevel = v, isFinite(p) && (d.z2 = p + (S && S.showAbove ? 1 : -1));
        }
        return p;
      }
      function u(h, c) {
        c.eachRendered(function(v) {
          if (!Yn(v)) {
            var p = v.getTextContent(), g = v.getTextGuideLine();
            v.stateTransition && (v.stateTransition = null), p && p.stateTransition && (p.stateTransition = null), g && g.stateTransition && (g.stateTransition = null), v.hasState() ? (v.prevStates = v.currentStates, v.clearStates()) : v.prevStates && (v.prevStates = null);
          }
        });
      }
      function f(h, c) {
        var v = h.getModel("stateAnimation"), p = h.isAnimationEnabled(), g = v.get("duration"), d = g > 0 ? {
          duration: g,
          delay: v.get("delay"),
          easing: v.get("easing")
          // additive: stateAnimationModel.get('additive')
        } : null;
        c.eachRendered(function(y) {
          if (y.states && y.states.emphasis) {
            if (Yn(y))
              return;
            if (y instanceof ot && fw(y), y.__dirty) {
              var m = y.prevStates;
              m && y.useStates(m);
            }
            if (p) {
              y.stateTransition = d;
              var _ = y.getTextContent(), S = y.getTextGuideLine();
              _ && (_.stateTransition = d), S && (S.stateTransition = d);
            }
            y.__dirty && n(y);
          }
        });
      }
      Rp = function(h) {
        return new /** @class */
        ((function(c) {
          F(v, c);
          function v() {
            return c !== null && c.apply(this, arguments) || this;
          }
          return v.prototype.getCoordinateSystems = function() {
            return h._coordSysMgr.getCoordinateSystems();
          }, v.prototype.getComponentByElement = function(p) {
            for (; p; ) {
              var g = p.__ecComponentInfo;
              if (g != null)
                return h._model.getComponent(g.mainType, g.index);
              p = p.parent;
            }
          }, v.prototype.enterEmphasis = function(p, g) {
            sa(p, g), ne(h);
          }, v.prototype.leaveEmphasis = function(p, g) {
            la(p, g), ne(h);
          }, v.prototype.enterBlur = function(p) {
            wy(p), ne(h);
          }, v.prototype.leaveBlur = function(p) {
            yh(p), ne(h);
          }, v.prototype.enterSelect = function(p) {
            xy(p), ne(h);
          }, v.prototype.leaveSelect = function(p) {
            Ty(p), ne(h);
          }, v.prototype.getModel = function() {
            return h.getModel();
          }, v.prototype.getViewOfComponentModel = function(p) {
            return h.getViewOfComponentModel(p);
          }, v.prototype.getViewOfSeriesModel = function(p) {
            return h.getViewOfSeriesModel(p);
          }, v;
        })(hm))(h);
      }, i0 = function(h) {
        function c(v, p) {
          for (var g = 0; g < v.length; g++) {
            var d = v[g];
            d[Ql] = p;
          }
        }
        T(qn, function(v, p) {
          h._messageCenter.on(p, function(g) {
            if (cs[h.group] && h[Ql] !== Ap) {
              if (g && g.escapeConnect)
                return;
              var d = h.makeActionFromEvent(g), y = [];
              T(fi, function(m) {
                m !== h && m.group === h.group && y.push(m);
              }), c(y, Ap), T(y, function(m) {
                m[Ql] !== qC && m.dispatchAction(d);
              }), c(y, KC);
            }
          });
        });
      };
    })(), t;
  })($e)
), Uh = fs.prototype;
Uh.on = Jm("on");
Uh.off = Jm("off");
Uh.one = function(r, t, e) {
  var i = this;
  function n() {
    for (var a = [], o = 0; o < arguments.length; o++)
      a[o] = arguments[o];
    t && t.apply && t.apply(this, a), i.off(r, n);
  }
  this.on.call(this, r, n, e);
};
var QC = ["click", "dblclick", "mouseover", "mouseout", "mousemove", "mousedown", "mouseup", "globalout", "contextmenu"];
var hs = {}, qn = {}, Tf = [], Cf = [], vs = [], n0 = {}, Mf = {}, fi = {}, cs = {}, JC = +/* @__PURE__ */ new Date() - 0, jC = +/* @__PURE__ */ new Date() - 0, Yh = "_echarts_instance_";
function a0(r, t, e) {
  var i = !(e && e.ssr);
  if (i) {
    var n = Ea(r);
    if (n)
      return n;
  }
  var a = new fs(r, t, e);
  return a.id = "ec_" + JC++, fi[a.id] = a, i && oy(r, Yh, a.id), i0(a), Ce.trigger("afterinit", a), a;
}
function tM(r) {
  if (O(r)) {
    var t = r;
    r = null, T(t, function(e) {
      e.group != null && (r = e.group);
    }), r = r || "g_" + jC++, T(t, function(e) {
      e.group = r;
    });
  }
  return cs[r] = !0, r;
}
function o0(r) {
  cs[r] = !1;
}
var eM = o0;
function rM(r) {
  V(r) ? r = fi[r] : r instanceof fs || (r = Ea(r)), r instanceof fs && !r.isDisposed() && r.dispose();
}
function Ea(r) {
  return fi[US(r, Yh)];
}
function iM(r) {
  return fi[r];
}
function Xh(r, t) {
  n0[r] = t;
}
function $h(r) {
  nt(Cf, r) < 0 && Cf.push(r);
}
function Zh(r, t) {
  qh(Tf, r, t, GC);
}
function s0(r) {
  Js("afterinit", r);
}
function l0(r) {
  Js("afterupdate", r);
}
function Js(r, t) {
  Ce.on(r, t);
}
function _i(r, t, e) {
  X(t) && (e = t, t = "");
  var i = H(r) ? r.type : [r, r = {
    event: t
  }][0];
  r.event = (r.event || i).toLowerCase(), t = r.event, !qn[t] && (Ee(Dp.test(i) && Dp.test(t)), hs[i] || (hs[i] = {
    action: e,
    actionInfo: r
  }), qn[t] = i);
}
function u0(r, t) {
  Ra.register(r, t);
}
function nM(r) {
  var t = Ra.get(r);
  if (t)
    return t.getDimensionsInfo ? t.getDimensionsInfo() : t.dimensions.slice();
}
function f0(r, t) {
  qh(vs, r, t, Zm, "layout");
}
function Lr(r, t) {
  qh(vs, r, t, qm, "visual");
}
var Op = [];
function qh(r, t, e, i, n) {
  if ((X(t) || H(t)) && (e = t, t = i), !(nt(Op, e) >= 0)) {
    Op.push(e);
    var a = Om.wrapStageHandler(e, n);
    a.__prio = t, a.__raw = e, r.push(a);
  }
}
function Kh(r, t) {
  Mf[r] = t;
}
function aM(r) {
  _g({
    createCanvas: r
  });
}
function h0(r, t, e) {
  var i = $m("registerMap");
  i && i(r, t, e);
}
function oM(r) {
  var t = $m("getMap");
  return t && t(r);
}
var v0 = cT;
Lr(Wh, WT);
Lr(Qs, UT);
Lr(Qs, YT);
Lr(Wh, nC);
Lr(Qs, aC);
Lr(Km, OC);
$h(cm);
Zh(VC, Kx);
Kh("default", XT);
_i({
  type: ui,
  event: ui,
  update: ui
}, Rt);
_i({
  type: ko,
  event: ko,
  update: ko
}, Rt);
_i({
  type: Gn,
  event: Gn,
  update: Gn
}, Rt);
_i({
  type: No,
  event: No,
  update: No
}, Rt);
_i({
  type: Wn,
  event: Wn,
  update: Wn
}, Rt);
Xh("light", rC);
Xh("dark", zm);
var sM = {};
function xn(r) {
  return r == null ? 0 : r.length || 1;
}
function kp(r) {
  return r;
}
var lM = (
  /** @class */
  (function() {
    function r(t, e, i, n, a, o) {
      this._old = t, this._new = e, this._oldKeyGetter = i || kp, this._newKeyGetter = n || kp, this.context = a, this._diffModeMultiple = o === "multiple";
    }
    return r.prototype.add = function(t) {
      return this._add = t, this;
    }, r.prototype.update = function(t) {
      return this._update = t, this;
    }, r.prototype.updateManyToOne = function(t) {
      return this._updateManyToOne = t, this;
    }, r.prototype.updateOneToMany = function(t) {
      return this._updateOneToMany = t, this;
    }, r.prototype.updateManyToMany = function(t) {
      return this._updateManyToMany = t, this;
    }, r.prototype.remove = function(t) {
      return this._remove = t, this;
    }, r.prototype.execute = function() {
      this[this._diffModeMultiple ? "_executeMultiple" : "_executeOneToOne"]();
    }, r.prototype._executeOneToOne = function() {
      var t = this._old, e = this._new, i = {}, n = new Array(t.length), a = new Array(e.length);
      this._initIndexMap(t, null, n, "_oldKeyGetter"), this._initIndexMap(e, i, a, "_newKeyGetter");
      for (var o = 0; o < t.length; o++) {
        var s = n[o], l = i[s], u = xn(l);
        if (u > 1) {
          var f = l.shift();
          l.length === 1 && (i[s] = l[0]), this._update && this._update(f, o);
        } else u === 1 ? (i[s] = null, this._update && this._update(l, o)) : this._remove && this._remove(o);
      }
      this._performRestAdd(a, i);
    }, r.prototype._executeMultiple = function() {
      var t = this._old, e = this._new, i = {}, n = {}, a = [], o = [];
      this._initIndexMap(t, i, a, "_oldKeyGetter"), this._initIndexMap(e, n, o, "_newKeyGetter");
      for (var s = 0; s < a.length; s++) {
        var l = a[s], u = i[l], f = n[l], h = xn(u), c = xn(f);
        if (h > 1 && c === 1)
          this._updateManyToOne && this._updateManyToOne(f, u), n[l] = null;
        else if (h === 1 && c > 1)
          this._updateOneToMany && this._updateOneToMany(f, u), n[l] = null;
        else if (h === 1 && c === 1)
          this._update && this._update(f, u), n[l] = null;
        else if (h > 1 && c > 1)
          this._updateManyToMany && this._updateManyToMany(f, u), n[l] = null;
        else if (h > 1)
          for (var v = 0; v < h; v++)
            this._remove && this._remove(u[v]);
        else
          this._remove && this._remove(u);
      }
      this._performRestAdd(o, n);
    }, r.prototype._performRestAdd = function(t, e) {
      for (var i = 0; i < t.length; i++) {
        var n = t[i], a = e[n], o = xn(a);
        if (o > 1)
          for (var s = 0; s < o; s++)
            this._add && this._add(a[s]);
        else o === 1 && this._add && this._add(a);
        e[n] = null;
      }
    }, r.prototype._initIndexMap = function(t, e, i, n) {
      for (var a = this._diffModeMultiple, o = 0; o < t.length; o++) {
        var s = "_ec_" + this[n](t[o], o);
        if (a || (i[o] = s), !!e) {
          var l = e[s], u = xn(l);
          u === 0 ? (e[s] = o, a && i.push(s)) : u === 1 ? e[s] = [l, o] : l.push(o);
        }
      }
    }, r;
  })()
), uM = (
  /** @class */
  (function() {
    function r(t, e) {
      this._encode = t, this._schema = e;
    }
    return r.prototype.get = function() {
      return {
        // Do not generate full dimension name until fist used.
        fullDimensions: this._getFullDimensionNames(),
        encode: this._encode
      };
    }, r.prototype._getFullDimensionNames = function() {
      return this._cachedDimNames || (this._cachedDimNames = this._schema ? this._schema.makeOutputDimensionNames() : []), this._cachedDimNames;
    }, r;
  })()
);
function fM(r, t) {
  var e = {}, i = e.encode = {}, n = q(), a = [], o = [], s = {};
  T(r.dimensions, function(c) {
    var v = r.getDimensionInfo(c), p = v.coordDim;
    if (p) {
      var g = v.coordDimIndex;
      iu(i, p)[g] = c, v.isExtraCoord || (n.set(p, 1), vM(v.type) && (a[0] = c), iu(s, p)[g] = r.getDimensionIndex(v.name)), v.defaultTooltip && o.push(c);
    }
    om.each(function(d, y) {
      var m = iu(i, y), _ = v.otherDims[y];
      _ != null && _ !== !1 && (m[_] = v.name);
    });
  });
  var l = [], u = {};
  n.each(function(c, v) {
    var p = i[v];
    u[v] = p[0], l = l.concat(p);
  }), e.dataDimsOnCoord = l, e.dataDimIndicesOnCoord = z(l, function(c) {
    return r.getDimensionInfo(c).storeDimIndex;
  }), e.encodeFirstDimNotExtra = u;
  var f = i.label;
  f && f.length && (a = f.slice());
  var h = i.tooltip;
  return h && h.length ? o = h.slice() : o.length || (o = a.slice()), i.defaultedLabel = a, i.defaultedTooltip = o, e.userOutput = new uM(s, t), e;
}
function iu(r, t) {
  return r.hasOwnProperty(t) || (r[t] = []), r[t];
}
function hM(r) {
  return r === "category" ? "ordinal" : r === "time" ? "time" : "float";
}
function vM(r) {
  return !(r === "ordinal" || r === "time");
}
var Fo = (
  /** @class */
  /* @__PURE__ */ (function() {
    function r(t) {
      this.otherDims = {}, t != null && k(this, t);
    }
    return r;
  })()
), cM = bt(), pM = {
  float: "f",
  int: "i",
  ordinal: "o",
  number: "n",
  time: "t"
}, c0 = (
  /** @class */
  (function() {
    function r(t) {
      this.dimensions = t.dimensions, this._dimOmitted = t.dimensionOmitted, this.source = t.source, this._fullDimCount = t.fullDimensionCount, this._updateDimOmitted(t.dimensionOmitted);
    }
    return r.prototype.isDimensionOmitted = function() {
      return this._dimOmitted;
    }, r.prototype._updateDimOmitted = function(t) {
      this._dimOmitted = t, t && (this._dimNameMap || (this._dimNameMap = g0(this.source)));
    }, r.prototype.getSourceDimensionIndex = function(t) {
      return Z(this._dimNameMap.get(t), -1);
    }, r.prototype.getSourceDimension = function(t) {
      var e = this.source.dimensionsDefine;
      if (e)
        return e[t];
    }, r.prototype.makeStoreSchema = function() {
      for (var t = this._fullDimCount, e = gm(this.source), i = !y0(t), n = "", a = [], o = 0, s = 0; o < t; o++) {
        var l = void 0, u = void 0, f = void 0, h = this.dimensions[s];
        if (h && h.storeDimIndex === o)
          l = e ? h.name : null, u = h.type, f = h.ordinalMeta, s++;
        else {
          var c = this.getSourceDimension(o);
          c && (l = e ? c.name : null, u = c.type);
        }
        a.push({
          property: l,
          type: u,
          ordinalMeta: f
        }), e && l != null && (!h || !h.isCalculationCoord) && (n += i ? l.replace(/\`/g, "`1").replace(/\$/g, "`2") : l), n += "$", n += pM[u] || "f", f && (n += f.uid), n += "$";
      }
      var v = this.source, p = [v.seriesLayoutBy, v.startIndex, n].join("$$");
      return {
        dimensions: a,
        hash: p
      };
    }, r.prototype.makeOutputDimensionNames = function() {
      for (var t = [], e = 0, i = 0; e < this._fullDimCount; e++) {
        var n = void 0, a = this.dimensions[i];
        if (a && a.storeDimIndex === e)
          a.isCalculationCoord || (n = a.name), i++;
        else {
          var o = this.getSourceDimension(e);
          o && (n = o.name);
        }
        t.push(n);
      }
      return t;
    }, r.prototype.appendCalculationDimension = function(t) {
      this.dimensions.push(t), t.isCalculationCoord = !0, this._fullDimCount++, this._updateDimOmitted(!0);
    }, r;
  })()
);
function p0(r) {
  return r instanceof c0;
}
function d0(r) {
  for (var t = q(), e = 0; e < (r || []).length; e++) {
    var i = r[e], n = H(i) ? i.name : i;
    n != null && t.get(n) == null && t.set(n, e);
  }
  return t;
}
function g0(r) {
  var t = cM(r);
  return t.dimNameMap || (t.dimNameMap = d0(r.dimensionsDefine));
}
function y0(r) {
  return r > 30;
}
var Tn = H, ur = z, dM = typeof Int32Array > "u" ? Array : Int32Array, gM = "e\0\0", Np = -1, yM = ["hasItemOption", "_nameList", "_idList", "_invertedIndicesMap", "_dimSummary", "userOutput", "_rawData", "_dimValueGetter", "_nameDimIdx", "_idDimIdx", "_nameRepeatCount"], mM = ["_approximateExtent"], Bp, fo, Cn, Mn, nu, Dn, au, Kn = (
  /** @class */
  (function() {
    function r(t, e) {
      this.type = "list", this._dimOmitted = !1, this._nameList = [], this._idList = [], this._visual = {}, this._layout = {}, this._itemVisuals = [], this._itemLayouts = [], this._graphicEls = [], this._approximateExtent = {}, this._calculationInfo = {}, this.hasItemOption = !1, this.TRANSFERABLE_METHODS = ["cloneShallow", "downSample", "minmaxDownSample", "lttbDownSample", "map"], this.CHANGABLE_METHODS = ["filterSelf", "selectRange"], this.DOWNSAMPLE_METHODS = ["downSample", "minmaxDownSample", "lttbDownSample"];
      var i, n = !1;
      p0(t) ? (i = t.dimensions, this._dimOmitted = t.isDimensionOmitted(), this._schema = t) : (n = !0, i = t), i = i || ["x", "y"];
      for (var a = {}, o = [], s = {}, l = !1, u = {}, f = 0; f < i.length; f++) {
        var h = i[f], c = V(h) ? new Fo({
          name: h
        }) : h instanceof Fo ? h : new Fo(h), v = c.name;
        c.type = c.type || "float", c.coordDim || (c.coordDim = v, c.coordDimIndex = 0);
        var p = c.otherDims = c.otherDims || {};
        o.push(v), a[v] = c, u[v] != null && (l = !0), c.createInvertedIndices && (s[v] = []), p.itemName === 0 && (this._nameDimIdx = f), p.itemId === 0 && (this._idDimIdx = f), n && (c.storeDimIndex = f);
      }
      if (this.dimensions = o, this._dimInfos = a, this._initGetDimensionInfo(l), this.hostModel = e, this._invertedIndicesMap = s, this._dimOmitted) {
        var g = this._dimIdxToName = q();
        T(o, function(d) {
          g.set(a[d].storeDimIndex, d);
        });
      }
    }
    return r.prototype.getDimension = function(t) {
      var e = this._recognizeDimIndex(t);
      if (e == null)
        return t;
      if (e = t, !this._dimOmitted)
        return this.dimensions[e];
      var i = this._dimIdxToName.get(e);
      if (i != null)
        return i;
      var n = this._schema.getSourceDimension(e);
      if (n)
        return n.name;
    }, r.prototype.getDimensionIndex = function(t) {
      var e = this._recognizeDimIndex(t);
      if (e != null)
        return e;
      if (t == null)
        return -1;
      var i = this._getDimInfo(t);
      return i ? i.storeDimIndex : this._dimOmitted ? this._schema.getSourceDimensionIndex(t) : -1;
    }, r.prototype._recognizeDimIndex = function(t) {
      if (vt(t) || t != null && !isNaN(t) && !this._getDimInfo(t) && (!this._dimOmitted || this._schema.getSourceDimensionIndex(t) < 0))
        return +t;
    }, r.prototype._getStoreDimIndex = function(t) {
      var e = this.getDimensionIndex(t);
      return e;
    }, r.prototype.getDimensionInfo = function(t) {
      return this._getDimInfo(this.getDimension(t));
    }, r.prototype._initGetDimensionInfo = function(t) {
      var e = this._dimInfos;
      this._getDimInfo = t ? function(i) {
        return e.hasOwnProperty(i) ? e[i] : void 0;
      } : function(i) {
        return e[i];
      };
    }, r.prototype.getDimensionsOnCoord = function() {
      return this._dimSummary.dataDimsOnCoord.slice();
    }, r.prototype.mapDimension = function(t, e) {
      var i = this._dimSummary;
      if (e == null)
        return i.encodeFirstDimNotExtra[t];
      var n = i.encode[t];
      return n ? n[e] : null;
    }, r.prototype.mapDimensionsAll = function(t) {
      var e = this._dimSummary, i = e.encode[t];
      return (i || []).slice();
    }, r.prototype.getStore = function() {
      return this._store;
    }, r.prototype.initData = function(t, e, i) {
      var n = this, a;
      if (t instanceof pf && (a = t), !a) {
        var o = this.dimensions, s = kh(t) || Ht(t) ? new ym(t, o.length) : t;
        a = new pf();
        var l = ur(o, function(u) {
          return {
            type: n._dimInfos[u].type,
            property: u
          };
        });
        a.initData(s, l, i);
      }
      this._store = a, this._nameList = (e || []).slice(), this._idList = [], this._nameRepeatCount = {}, this._doInit(0, a.count()), this._dimSummary = fM(this, this._schema), this.userOutput = this._dimSummary.userOutput;
    }, r.prototype.appendData = function(t) {
      var e = this._store.appendData(t);
      this._doInit(e[0], e[1]);
    }, r.prototype.appendValues = function(t, e) {
      var i = this._store.appendValues(t, e && e.length), n = i.start, a = i.end, o = this._shouldMakeIdFromName();
      if (this._updateOrdinalMeta(), e)
        for (var s = n; s < a; s++) {
          var l = s - n;
          this._nameList[s] = e[l], o && au(this, s);
        }
    }, r.prototype._updateOrdinalMeta = function() {
      for (var t = this._store, e = this.dimensions, i = 0; i < e.length; i++) {
        var n = this._dimInfos[e[i]];
        n.ordinalMeta && t.collectOrdinalMeta(n.storeDimIndex, n.ordinalMeta);
      }
    }, r.prototype._shouldMakeIdFromName = function() {
      var t = this._store.getProvider();
      return this._idDimIdx == null && t.getSource().sourceFormat !== xr && !t.fillStorage;
    }, r.prototype._doInit = function(t, e) {
      if (!(t >= e)) {
        var i = this._store, n = i.getProvider();
        this._updateOrdinalMeta();
        var a = this._nameList, o = this._idList, s = n.getSource().sourceFormat, l = s === _e;
        if (l && !n.pure)
          for (var u = [], f = t; f < e; f++) {
            var h = n.getItem(f, u);
            if (!this.hasItemOption && RS(h) && (this.hasItemOption = !0), h) {
              var c = h.name;
              a[f] == null && c != null && (a[f] = Pe(c, null));
              var v = h.id;
              o[f] == null && v != null && (o[f] = Pe(v, null));
            }
          }
        if (this._shouldMakeIdFromName())
          for (var f = t; f < e; f++)
            au(this, f);
        Bp(this);
      }
    }, r.prototype.getApproximateExtent = function(t) {
      return this._approximateExtent[t] || this._store.getDataExtent(this._getStoreDimIndex(t));
    }, r.prototype.setApproximateExtent = function(t, e) {
      e = this.getDimension(e), this._approximateExtent[e] = t.slice();
    }, r.prototype.getCalculationInfo = function(t) {
      return this._calculationInfo[t];
    }, r.prototype.setCalculationInfo = function(t, e) {
      Tn(t) ? k(this._calculationInfo, t) : this._calculationInfo[t] = e;
    }, r.prototype.getName = function(t) {
      var e = this.getRawIndex(t), i = this._nameList[e];
      return i == null && this._nameDimIdx != null && (i = Cn(this, this._nameDimIdx, e)), i == null && (i = ""), i;
    }, r.prototype._getCategory = function(t, e) {
      var i = this._store.get(t, e), n = this._store.getOrdinalMeta(t);
      return n ? n.categories[i] : i;
    }, r.prototype.getId = function(t) {
      return fo(this, this.getRawIndex(t));
    }, r.prototype.count = function() {
      return this._store.count();
    }, r.prototype.get = function(t, e) {
      var i = this._store, n = this._dimInfos[t];
      if (n)
        return i.get(n.storeDimIndex, e);
    }, r.prototype.getByRawIndex = function(t, e) {
      var i = this._store, n = this._dimInfos[t];
      if (n)
        return i.getByRawIndex(n.storeDimIndex, e);
    }, r.prototype.getIndices = function() {
      return this._store.getIndices();
    }, r.prototype.getDataExtent = function(t) {
      return this._store.getDataExtent(this._getStoreDimIndex(t));
    }, r.prototype.getSum = function(t) {
      return this._store.getSum(this._getStoreDimIndex(t));
    }, r.prototype.getMedian = function(t) {
      return this._store.getMedian(this._getStoreDimIndex(t));
    }, r.prototype.getValues = function(t, e) {
      var i = this, n = this._store;
      return O(t) ? n.getValues(ur(t, function(a) {
        return i._getStoreDimIndex(a);
      }), e) : n.getValues(t);
    }, r.prototype.hasValue = function(t) {
      for (var e = this._dimSummary.dataDimIndicesOnCoord, i = 0, n = e.length; i < n; i++)
        if (isNaN(this._store.get(e[i], t)))
          return !1;
      return !0;
    }, r.prototype.indexOfName = function(t) {
      for (var e = 0, i = this._store.count(); e < i; e++)
        if (this.getName(e) === t)
          return e;
      return -1;
    }, r.prototype.getRawIndex = function(t) {
      return this._store.getRawIndex(t);
    }, r.prototype.indexOfRawIndex = function(t) {
      return this._store.indexOfRawIndex(t);
    }, r.prototype.rawIndexOf = function(t, e) {
      var i = t && this._invertedIndicesMap[t], n = i && i[e];
      return n == null || isNaN(n) ? Np : n;
    }, r.prototype.indicesOfNearest = function(t, e, i) {
      return this._store.indicesOfNearest(this._getStoreDimIndex(t), e, i);
    }, r.prototype.each = function(t, e, i) {
      X(t) && (i = e, e = t, t = []);
      var n = i || this, a = ur(Mn(t), this._getStoreDimIndex, this);
      this._store.each(a, n ? Q(e, n) : e);
    }, r.prototype.filterSelf = function(t, e, i) {
      X(t) && (i = e, e = t, t = []);
      var n = i || this, a = ur(Mn(t), this._getStoreDimIndex, this);
      return this._store = this._store.filter(a, n ? Q(e, n) : e), this;
    }, r.prototype.selectRange = function(t) {
      var e = this, i = {}, n = ct(t);
      return T(n, function(a) {
        var o = e._getStoreDimIndex(a);
        i[o] = t[a];
      }), this._store = this._store.selectRange(i), this;
    }, r.prototype.mapArray = function(t, e, i) {
      X(t) && (i = e, e = t, t = []), i = i || this;
      var n = [];
      return this.each(t, function() {
        n.push(e && e.apply(this, arguments));
      }, i), n;
    }, r.prototype.map = function(t, e, i, n) {
      var a = i || n || this, o = ur(Mn(t), this._getStoreDimIndex, this), s = Dn(this);
      return s._store = this._store.map(o, a ? Q(e, a) : e), s;
    }, r.prototype.modify = function(t, e, i, n) {
      var a = i || n || this, o = ur(Mn(t), this._getStoreDimIndex, this);
      this._store.modify(o, a ? Q(e, a) : e);
    }, r.prototype.downSample = function(t, e, i, n) {
      var a = Dn(this);
      return a._store = this._store.downSample(this._getStoreDimIndex(t), e, i, n), a;
    }, r.prototype.minmaxDownSample = function(t, e) {
      var i = Dn(this);
      return i._store = this._store.minmaxDownSample(this._getStoreDimIndex(t), e), i;
    }, r.prototype.lttbDownSample = function(t, e) {
      var i = Dn(this);
      return i._store = this._store.lttbDownSample(this._getStoreDimIndex(t), e), i;
    }, r.prototype.getRawDataItem = function(t) {
      return this._store.getRawDataItem(t);
    }, r.prototype.getItemModel = function(t) {
      var e = this.hostModel, i = this.getRawDataItem(t);
      return new pt(i, e, e && e.ecModel);
    }, r.prototype.diff = function(t) {
      var e = this;
      return new lM(t ? t.getStore().getIndices() : [], this.getStore().getIndices(), function(i) {
        return fo(t, i);
      }, function(i) {
        return fo(e, i);
      });
    }, r.prototype.getVisual = function(t) {
      var e = this._visual;
      return e && e[t];
    }, r.prototype.setVisual = function(t, e) {
      this._visual = this._visual || {}, Tn(t) ? k(this._visual, t) : this._visual[t] = e;
    }, r.prototype.getItemVisual = function(t, e) {
      var i = this._itemVisuals[t], n = i && i[e];
      return n ?? this.getVisual(e);
    }, r.prototype.hasItemVisual = function() {
      return this._itemVisuals.length > 0;
    }, r.prototype.ensureUniqueItemVisual = function(t, e) {
      var i = this._itemVisuals, n = i[t];
      n || (n = i[t] = {});
      var a = n[e];
      return a == null && (a = this.getVisual(e), O(a) ? a = a.slice() : Tn(a) && (a = k({}, a)), n[e] = a), a;
    }, r.prototype.setItemVisual = function(t, e, i) {
      var n = this._itemVisuals[t] || {};
      this._itemVisuals[t] = n, Tn(e) ? k(n, e) : n[e] = i;
    }, r.prototype.clearAllVisual = function() {
      this._visual = {}, this._itemVisuals = [];
    }, r.prototype.setLayout = function(t, e) {
      Tn(t) ? k(this._layout, t) : this._layout[t] = e;
    }, r.prototype.getLayout = function(t) {
      return this._layout[t];
    }, r.prototype.getItemLayout = function(t) {
      return this._itemLayouts[t];
    }, r.prototype.setItemLayout = function(t, e, i) {
      this._itemLayouts[t] = i ? k(this._itemLayouts[t] || {}, e) : e;
    }, r.prototype.clearItemLayouts = function() {
      this._itemLayouts.length = 0;
    }, r.prototype.setItemGraphicEl = function(t, e) {
      var i = this.hostModel && this.hostModel.seriesIndex;
      Yb(i, this.dataType, t, e), this._graphicEls[t] = e;
    }, r.prototype.getItemGraphicEl = function(t) {
      return this._graphicEls[t];
    }, r.prototype.eachItemGraphicEl = function(t, e) {
      T(this._graphicEls, function(i, n) {
        i && t && t.call(e, i, n);
      });
    }, r.prototype.cloneShallow = function(t) {
      return t || (t = new r(this._schema ? this._schema : ur(this.dimensions, this._getDimInfo, this), this.hostModel)), nu(t, this), t._store = this._store, t;
    }, r.prototype.wrapMethod = function(t, e) {
      var i = this[t];
      X(i) && (this.__wrappedMethods = this.__wrappedMethods || [], this.__wrappedMethods.push(t), this[t] = function() {
        var n = i.apply(this, arguments);
        return e.apply(this, [n].concat(Ss(arguments)));
      });
    }, r.internalField = (function() {
      Bp = function(t) {
        var e = t._invertedIndicesMap;
        T(e, function(i, n) {
          var a = t._dimInfos[n], o = a.ordinalMeta, s = t._store;
          if (o) {
            i = e[n] = new dM(o.categories.length);
            for (var l = 0; l < i.length; l++)
              i[l] = Np;
            for (var l = 0; l < s.count(); l++)
              i[s.get(a.storeDimIndex, l)] = l;
          }
        });
      }, Cn = function(t, e, i) {
        return Pe(t._getCategory(e, i), null);
      }, fo = function(t, e) {
        var i = t._idList[e];
        return i == null && t._idDimIdx != null && (i = Cn(t, t._idDimIdx, e)), i == null && (i = gM + e), i;
      }, Mn = function(t) {
        return O(t) || (t = t != null ? [t] : []), t;
      }, Dn = function(t) {
        var e = new r(t._schema ? t._schema : ur(t.dimensions, t._getDimInfo, t), t.hostModel);
        return nu(e, t), e;
      }, nu = function(t, e) {
        T(yM.concat(e.__wrappedMethods || []), function(i) {
          e.hasOwnProperty(i) && (t[i] = e[i]);
        }), t.__wrappedMethods = e.__wrappedMethods, T(mM, function(i) {
          t[i] = U(e[i]);
        }), t._calculationInfo = k({}, e._calculationInfo);
      }, au = function(t, e) {
        var i = t._nameList, n = t._idList, a = t._nameDimIdx, o = t._idDimIdx, s = i[e], l = n[e];
        if (s == null && a != null && (i[e] = s = Cn(t, a, e)), l == null && o != null && (n[e] = l = Cn(t, o, e)), l == null && s != null) {
          var u = t._nameRepeatCount, f = u[s] = (u[s] || 0) + 1;
          l = s, f > 1 && (l += "__ec__" + f), n[e] = l;
        }
      };
    })(), r;
  })()
);
function _M(r, t) {
  return m0(r, t).dimensions;
}
function m0(r, t) {
  kh(r) || (r = pm(r)), t = t || {};
  var e = t.coordDimensions || [], i = t.dimensionsDefine || r.dimensionsDefine || [], n = q(), a = [], o = bM(r, e, i, t.dimensionsCount), s = t.canOmitUnusedDimensions && y0(o), l = i === r.dimensionsDefine, u = l ? g0(r) : d0(i), f = t.encodeDefine;
  !f && t.encodeDefaulter && (f = t.encodeDefaulter(r, o));
  for (var h = q(f), c = new wm(o), v = 0; v < c.length; v++)
    c[v] = -1;
  function p(D) {
    var A = c[D];
    if (A < 0) {
      var C = i[D], I = H(C) ? C : {
        name: C
      }, L = new Fo(), P = I.name;
      P != null && u.get(P) != null && (L.name = L.displayName = P), I.type != null && (L.type = I.type), I.displayName != null && (L.displayName = I.displayName);
      var R = a.length;
      return c[D] = R, L.storeDimIndex = D, a.push(L), L;
    }
    return a[A];
  }
  if (!s)
    for (var v = 0; v < o; v++)
      p(v);
  h.each(function(D, A) {
    var C = Dt(D).slice();
    if (C.length === 1 && !V(C[0]) && C[0] < 0) {
      h.set(A, !1);
      return;
    }
    var I = h.set(A, []);
    T(C, function(L, P) {
      var R = V(L) ? u.get(L) : L;
      R != null && R < o && (I[P] = R, d(p(R), A, P));
    });
  });
  var g = 0;
  T(e, function(D) {
    var A, C, I, L;
    if (V(D))
      A = D, L = {};
    else {
      L = D, A = L.name;
      var P = L.ordinalMeta;
      L.ordinalMeta = null, L = k({}, L), L.ordinalMeta = P, C = L.dimsDef, I = L.otherDims, L.name = L.coordDim = L.coordDimIndex = L.dimsDef = L.otherDims = null;
    }
    var R = h.get(A);
    if (R !== !1) {
      if (R = Dt(R), !R.length)
        for (var E = 0; E < (C && C.length || 1); E++) {
          for (; g < o && p(g).coordDim != null; )
            g++;
          g < o && R.push(g++);
        }
      T(R, function(G, N) {
        var B = p(G);
        if (l && L.type != null && (B.type = L.type), d(at(B, L), A, N), B.name == null && C) {
          var W = C[N];
          !H(W) && (W = {
            name: W
          }), B.name = B.displayName = W.name, B.defaultTooltip = W.defaultTooltip;
        }
        I && at(B.otherDims, I);
      });
    }
  });
  function d(D, A, C) {
    om.get(A) != null ? D.otherDims[A] = C : (D.coordDim = A, D.coordDimIndex = C, n.set(A, !0));
  }
  var y = t.generateCoord, m = t.generateCoordCount, _ = m != null;
  m = y ? m || 1 : 0;
  var S = y || "value";
  function w(D) {
    D.name == null && (D.name = D.coordDim);
  }
  if (s)
    T(a, function(D) {
      w(D);
    }), a.sort(function(D, A) {
      return D.storeDimIndex - A.storeDimIndex;
    });
  else
    for (var b = 0; b < o; b++) {
      var x = p(b), M = x.coordDim;
      M == null && (x.coordDim = wM(S, n, _), x.coordDimIndex = 0, (!y || m <= 0) && (x.isExtraCoord = !0), m--), w(x), x.type == null && (fm(r, b) === jt.Must || x.isExtraCoord && (x.otherDims.itemName != null || x.otherDims.seriesName != null)) && (x.type = "ordinal");
    }
  return SM(a), new c0({
    source: r,
    dimensions: a,
    fullDimensionCount: o,
    dimensionOmitted: s
  });
}
function SM(r) {
  for (var t = q(), e = 0; e < r.length; e++) {
    var i = r[e], n = i.name, a = t.get(n) || 0;
    a > 0 && (i.name = n + (a - 1)), a++, t.set(n, a);
  }
}
function bM(r, t, e, i) {
  var n = Math.max(r.dimensionsDetectedCount || 1, t.length, e.length, i || 0);
  return T(t, function(a) {
    var o;
    H(a) && (o = a.dimsDef) && (n = Math.max(n, o.length));
  }), n;
}
function wM(r, t, e) {
  if (e || t.hasKey(r)) {
    for (var i = 0; t.hasKey(r + i); )
      i++;
    r += i;
  }
  return t.set(r, !0), r;
}
var xM = (
  /** @class */
  /* @__PURE__ */ (function() {
    function r(t) {
      this.coordSysDims = [], this.axisMap = q(), this.categoryAxisMap = q(), this.coordSysName = t;
    }
    return r;
  })()
);
function TM(r) {
  var t = r.get("coordinateSystem"), e = new xM(t), i = CM[t];
  if (i)
    return i(r, e, e.axisMap, e.categoryAxisMap), e;
}
var CM = {
  cartesian2d: function(r, t, e, i) {
    var n = r.getReferringComponents("xAxis", Ae).models[0], a = r.getReferringComponents("yAxis", Ae).models[0];
    t.coordSysDims = ["x", "y"], e.set("x", n), e.set("y", a), Oi(n) && (i.set("x", n), t.firstCategoryDimIndex = 0), Oi(a) && (i.set("y", a), t.firstCategoryDimIndex == null && (t.firstCategoryDimIndex = 1));
  },
  singleAxis: function(r, t, e, i) {
    var n = r.getReferringComponents("singleAxis", Ae).models[0];
    t.coordSysDims = ["single"], e.set("single", n), Oi(n) && (i.set("single", n), t.firstCategoryDimIndex = 0);
  },
  polar: function(r, t, e, i) {
    var n = r.getReferringComponents("polar", Ae).models[0], a = n.findAxisModel("radiusAxis"), o = n.findAxisModel("angleAxis");
    t.coordSysDims = ["radius", "angle"], e.set("radius", a), e.set("angle", o), Oi(a) && (i.set("radius", a), t.firstCategoryDimIndex = 0), Oi(o) && (i.set("angle", o), t.firstCategoryDimIndex == null && (t.firstCategoryDimIndex = 1));
  },
  geo: function(r, t, e, i) {
    t.coordSysDims = ["lng", "lat"];
  },
  parallel: function(r, t, e, i) {
    var n = r.ecModel, a = n.getComponent("parallel", r.get("parallelIndex")), o = t.coordSysDims = a.dimensions.slice();
    T(a.parallelAxisIndex, function(s, l) {
      var u = n.getComponent("parallelAxis", s), f = o[l];
      e.set(f, u), Oi(u) && (i.set(f, u), t.firstCategoryDimIndex == null && (t.firstCategoryDimIndex = l));
    });
  }
};
function Oi(r) {
  return r.get("type") === "category";
}
function _0(r, t, e) {
  e = e || {};
  var i = e.byIndex, n = e.stackedCoordDimension, a, o, s;
  MM(t) ? a = t : (o = t.schema, a = o.dimensions, s = t.store);
  var l = !!(r && r.get("stack")), u, f, h, c;
  if (T(a, function(m, _) {
    V(m) && (a[_] = m = {
      name: m
    }), l && !m.isExtraCoord && (!i && !u && m.ordinalMeta && (u = m), !f && m.type !== "ordinal" && m.type !== "time" && (!n || n === m.coordDim) && (f = m));
  }), f && !i && !u && (i = !0), f) {
    h = "__\0ecstackresult_" + r.id, c = "__\0ecstackedover_" + r.id, u && (u.createInvertedIndices = !0);
    var v = f.coordDim, p = f.type, g = 0;
    T(a, function(m) {
      m.coordDim === v && g++;
    });
    var d = {
      name: h,
      coordDim: v,
      coordDimIndex: g,
      type: p,
      isExtraCoord: !0,
      isCalculationCoord: !0,
      storeDimIndex: a.length
    }, y = {
      name: c,
      // This dimension contains stack base (generally, 0), so do not set it as
      // `stackedDimCoordDim` to avoid extent calculation, consider log scale.
      coordDim: c,
      coordDimIndex: g + 1,
      type: p,
      isExtraCoord: !0,
      isCalculationCoord: !0,
      storeDimIndex: a.length + 1
    };
    o ? (s && (d.storeDimIndex = s.ensureCalculationDimension(c, p), y.storeDimIndex = s.ensureCalculationDimension(h, p)), o.appendCalculationDimension(d), o.appendCalculationDimension(y)) : (a.push(d), a.push(y));
  }
  return {
    stackedDimension: f && f.name,
    stackedByDimension: u && u.name,
    isStackedByIndex: i,
    stackedOverDimension: c,
    stackResultDimension: h
  };
}
function MM(r) {
  return !p0(r.schema);
}
function Ir(r, t) {
  return !!t && t === r.getCalculationInfo("stackedDimension");
}
function Qh(r, t) {
  return Ir(r, t) ? r.getCalculationInfo("stackResultDimension") : t;
}
function DM(r, t) {
  var e = r.get("coordinateSystem"), i = Ra.get(e), n;
  return t && t.coordSysDims && (n = z(t.coordSysDims, function(a) {
    var o = {
      name: a
    }, s = t.axisMap.get(a);
    if (s) {
      var l = s.get("type");
      o.type = hM(l);
    }
    return o;
  })), n || (n = i && (i.getDimensionsInfo ? i.getDimensionsInfo() : i.dimensions.slice()) || ["x", "y"]), n;
}
function AM(r, t, e) {
  var i, n;
  return e && T(r, function(a, o) {
    var s = a.coordDim, l = e.categoryAxisMap.get(s);
    l && (i == null && (i = o), a.ordinalMeta = l.getOrdinalMeta(), t && (a.createInvertedIndices = !0)), a.otherDims.itemName != null && (n = !0);
  }), !n && i != null && (r[i].otherDims.itemName = 0), i;
}
function sn(r, t, e) {
  e = e || {};
  var i = t.getSourceManager(), n, a = !1;
  n = i.getSource(), a = n.sourceFormat === _e;
  var o = TM(t), s = DM(t, o), l = e.useEncodeDefaulter, u = X(l) ? l : l ? ht(Cx, s, t) : null, f = {
    coordDimensions: s,
    generateCoord: e.generateCoord,
    encodeDefine: t.getEncode(),
    encodeDefaulter: u,
    canOmitUnusedDimensions: !a
  }, h = m0(n, f), c = AM(h.dimensions, e.createInvertedIndices, o), v = a ? null : i.getSharedDataStore(h), p = _0(t, {
    schema: h,
    store: v
  }), g = new Kn(h, t);
  g.setCalculationInfo(p);
  var d = c != null && IM(n) ? function(y, m, _, S) {
    return S === c ? _ : this.defaultDimValueGetter(y, m, _, S);
  } : null;
  return g.hasItemOption = !1, g.initData(
    // Try to reuse the data store in sourceManager if using dataset.
    a ? n : v,
    null,
    d
  ), g;
}
function IM(r) {
  if (r.sourceFormat === _e) {
    var t = LM(r.data || []);
    return !O(Ta(t));
  }
}
function LM(r) {
  for (var t = 0; t < r.length && r[t] == null; )
    t++;
  return r[t];
}
var qe = (
  /** @class */
  (function() {
    function r(t) {
      this._setting = t || {}, this._extent = [1 / 0, -1 / 0];
    }
    return r.prototype.getSetting = function(t) {
      return this._setting[t];
    }, r.prototype.unionExtent = function(t) {
      var e = this._extent;
      t[0] < e[0] && (e[0] = t[0]), t[1] > e[1] && (e[1] = t[1]);
    }, r.prototype.unionExtentFromData = function(t, e) {
      this.unionExtent(t.getApproximateExtent(e));
    }, r.prototype.getExtent = function() {
      return this._extent.slice();
    }, r.prototype.setExtent = function(t, e) {
      var i = this._extent;
      isNaN(t) || (i[0] = t), isNaN(e) || (i[1] = e);
    }, r.prototype.isInExtentRange = function(t) {
      return this._extent[0] <= t && this._extent[1] >= t;
    }, r.prototype.isBlank = function() {
      return this._isBlank;
    }, r.prototype.setBlank = function(t) {
      this._isBlank = t;
    }, r;
  })()
);
Cs(qe);
var PM = 0, Df = (
  /** @class */
  (function() {
    function r(t) {
      this.categories = t.categories || [], this._needCollect = t.needCollect, this._deduplication = t.deduplication, this.uid = ++PM;
    }
    return r.createByAxisModel = function(t) {
      var e = t.option, i = e.data, n = i && z(i, RM);
      return new r({
        categories: n,
        needCollect: !n,
        // deduplication is default in axis.
        deduplication: e.dedplication !== !1
      });
    }, r.prototype.getOrdinal = function(t) {
      return this._getOrCreateMap().get(t);
    }, r.prototype.parseAndCollect = function(t) {
      var e, i = this._needCollect;
      if (!V(t) && !i)
        return t;
      if (i && !this._deduplication)
        return e = this.categories.length, this.categories[e] = t, e;
      var n = this._getOrCreateMap();
      return e = n.get(t), e == null && (i ? (e = this.categories.length, this.categories[e] = t, n.set(t, e)) : e = NaN), e;
    }, r.prototype._getOrCreateMap = function() {
      return this._map || (this._map = q(this.categories));
    }, r;
  })()
);
function RM(r) {
  return H(r) && r.value != null ? r.value : r + "";
}
function Af(r) {
  return r.type === "interval" || r.type === "log";
}
function EM(r, t, e, i) {
  var n = {}, a = r[1] - r[0], o = n.interval = fh(a / t, !0);
  e != null && o < e && (o = n.interval = e), i != null && o > i && (o = n.interval = i);
  var s = n.intervalPrecision = S0(o), l = n.niceTickExtent = [St(Math.ceil(r[0] / o) * o, s), St(Math.floor(r[1] / o) * o, s)];
  return OM(l, r), n;
}
function ou(r) {
  var t = Math.pow(10, Ts(r)), e = r / t;
  return e ? e === 2 ? e = 3 : e === 3 ? e = 5 : e *= 2 : e = 1, St(e * t);
}
function S0(r) {
  return De(r) + 2;
}
function zp(r, t, e) {
  r[t] = Math.max(Math.min(r[t], e[1]), e[0]);
}
function OM(r, t) {
  !isFinite(r[0]) && (r[0] = t[0]), !isFinite(r[1]) && (r[1] = t[1]), zp(r, 0, t), zp(r, 1, t), r[0] > r[1] && (r[0] = r[1]);
}
function js(r, t) {
  return r >= t[0] && r <= t[1];
}
function tl(r, t) {
  return t[1] === t[0] ? 0.5 : (r - t[0]) / (t[1] - t[0]);
}
function el(r, t) {
  return r * (t[1] - t[0]) + t[0];
}
var Jh = (
  /** @class */
  (function(r) {
    F(t, r);
    function t(e) {
      var i = r.call(this, e) || this;
      i.type = "ordinal";
      var n = i.getSetting("ordinalMeta");
      return n || (n = new Df({})), O(n) && (n = new Df({
        categories: z(n, function(a) {
          return H(a) ? a.value : a;
        })
      })), i._ordinalMeta = n, i._extent = i.getSetting("extent") || [0, n.categories.length - 1], i;
    }
    return t.prototype.parse = function(e) {
      return e == null ? NaN : V(e) ? this._ordinalMeta.getOrdinal(e) : Math.round(e);
    }, t.prototype.contain = function(e) {
      return e = this.parse(e), js(e, this._extent) && this._ordinalMeta.categories[e] != null;
    }, t.prototype.normalize = function(e) {
      return e = this._getTickNumber(this.parse(e)), tl(e, this._extent);
    }, t.prototype.scale = function(e) {
      return e = Math.round(el(e, this._extent)), this.getRawOrdinalNumber(e);
    }, t.prototype.getTicks = function() {
      for (var e = [], i = this._extent, n = i[0]; n <= i[1]; )
        e.push({
          value: n
        }), n++;
      return e;
    }, t.prototype.getMinorTicks = function(e) {
    }, t.prototype.setSortInfo = function(e) {
      if (e == null) {
        this._ordinalNumbersByTick = this._ticksByOrdinalNumber = null;
        return;
      }
      for (var i = e.ordinalNumbers, n = this._ordinalNumbersByTick = [], a = this._ticksByOrdinalNumber = [], o = 0, s = this._ordinalMeta.categories.length, l = Math.min(s, i.length); o < l; ++o) {
        var u = i[o];
        n[o] = u, a[u] = o;
      }
      for (var f = 0; o < s; ++o) {
        for (; a[f] != null; )
          f++;
        n.push(f), a[f] = o;
      }
    }, t.prototype._getTickNumber = function(e) {
      var i = this._ticksByOrdinalNumber;
      return i && e >= 0 && e < i.length ? i[e] : e;
    }, t.prototype.getRawOrdinalNumber = function(e) {
      var i = this._ordinalNumbersByTick;
      return i && e >= 0 && e < i.length ? i[e] : e;
    }, t.prototype.getLabel = function(e) {
      if (!this.isBlank()) {
        var i = this.getRawOrdinalNumber(e.value), n = this._ordinalMeta.categories[i];
        return n == null ? "" : n + "";
      }
    }, t.prototype.count = function() {
      return this._extent[1] - this._extent[0] + 1;
    }, t.prototype.unionExtentFromData = function(e, i) {
      this.unionExtent(e.getApproximateExtent(i));
    }, t.prototype.isInExtentRange = function(e) {
      return e = this._getTickNumber(e), this._extent[0] <= e && this._extent[1] >= e;
    }, t.prototype.getOrdinalMeta = function() {
      return this._ordinalMeta;
    }, t.prototype.calcNiceTicks = function() {
    }, t.prototype.calcNiceExtent = function() {
    }, t.type = "ordinal", t;
  })(qe)
);
qe.registerClass(Jh);
var Jr = St, ln = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = "interval", e._interval = 0, e._intervalPrecision = 2, e;
    }
    return t.prototype.parse = function(e) {
      return e;
    }, t.prototype.contain = function(e) {
      return js(e, this._extent);
    }, t.prototype.normalize = function(e) {
      return tl(e, this._extent);
    }, t.prototype.scale = function(e) {
      return el(e, this._extent);
    }, t.prototype.setExtent = function(e, i) {
      var n = this._extent;
      isNaN(e) || (n[0] = parseFloat(e)), isNaN(i) || (n[1] = parseFloat(i));
    }, t.prototype.unionExtent = function(e) {
      var i = this._extent;
      e[0] < i[0] && (i[0] = e[0]), e[1] > i[1] && (i[1] = e[1]), this.setExtent(i[0], i[1]);
    }, t.prototype.getInterval = function() {
      return this._interval;
    }, t.prototype.setInterval = function(e) {
      this._interval = e, this._niceExtent = this._extent.slice(), this._intervalPrecision = S0(e);
    }, t.prototype.getTicks = function(e) {
      var i = this._interval, n = this._extent, a = this._niceExtent, o = this._intervalPrecision, s = [];
      if (!i)
        return s;
      var l = 1e4;
      n[0] < a[0] && (e ? s.push({
        value: Jr(a[0] - i, o)
      }) : s.push({
        value: n[0]
      }));
      for (var u = a[0]; u <= a[1] && (s.push({
        value: u
      }), u = Jr(u + i, o), u !== s[s.length - 1].value); )
        if (s.length > l)
          return [];
      var f = s.length ? s[s.length - 1].value : a[1];
      return n[1] > f && (e ? s.push({
        value: Jr(f + i, o)
      }) : s.push({
        value: n[1]
      })), s;
    }, t.prototype.getMinorTicks = function(e) {
      for (var i = this.getTicks(!0), n = [], a = this.getExtent(), o = 1; o < i.length; o++) {
        for (var s = i[o], l = i[o - 1], u = 0, f = [], h = s.value - l.value, c = h / e; u < e - 1; ) {
          var v = Jr(l.value + (u + 1) * c);
          v > a[0] && v < a[1] && f.push(v), u++;
        }
        n.push(f);
      }
      return n;
    }, t.prototype.getLabel = function(e, i) {
      if (e == null)
        return "";
      var n = i && i.precision;
      n == null ? n = De(e.value) || 0 : n === "auto" && (n = this._intervalPrecision);
      var a = Jr(e.value, n, !0);
      return Ih(a);
    }, t.prototype.calcNiceTicks = function(e, i, n) {
      e = e || 5;
      var a = this._extent, o = a[1] - a[0];
      if (isFinite(o)) {
        o < 0 && (o = -o, a.reverse());
        var s = EM(a, e, i, n);
        this._intervalPrecision = s.intervalPrecision, this._interval = s.interval, this._niceExtent = s.niceTickExtent;
      }
    }, t.prototype.calcNiceExtent = function(e) {
      var i = this._extent;
      if (i[0] === i[1])
        if (i[0] !== 0) {
          var n = Math.abs(i[0]);
          e.fixMax || (i[1] += n / 2), i[0] -= n / 2;
        } else
          i[1] = 1;
      var a = i[1] - i[0];
      isFinite(a) || (i[0] = 0, i[1] = 1), this.calcNiceTicks(e.splitNumber, e.minInterval, e.maxInterval);
      var o = this._interval;
      e.fixMin || (i[0] = Jr(Math.floor(i[0] / o) * o)), e.fixMax || (i[1] = Jr(Math.ceil(i[1] / o) * o));
    }, t.prototype.setNiceExtent = function(e, i) {
      this._niceExtent = [e, i];
    }, t.type = "interval", t;
  })(qe)
);
qe.registerClass(ln);
var b0 = typeof Float32Array < "u", kM = b0 ? Float32Array : Array;
function tr(r) {
  return O(r) ? b0 ? new Float32Array(r) : r : new kM(r);
}
var NM = "__ec_stack_";
function w0(r) {
  return r.get("stack") || NM + r.seriesIndex;
}
function jh(r) {
  return r.dim + r.index;
}
function x0(r, t) {
  var e = [];
  return t.eachSeriesByType(r, function(i) {
    C0(i) && e.push(i);
  }), e;
}
function BM(r) {
  var t = {};
  T(r, function(l) {
    var u = l.coordinateSystem, f = u.getBaseAxis();
    if (!(f.type !== "time" && f.type !== "value"))
      for (var h = l.getData(), c = f.dim + "_" + f.index, v = h.getDimensionIndex(h.mapDimension(f.dim)), p = h.getStore(), g = 0, d = p.count(); g < d; ++g) {
        var y = p.get(v, g);
        t[c] ? t[c].push(y) : t[c] = [y];
      }
  });
  var e = {};
  for (var i in t)
    if (t.hasOwnProperty(i)) {
      var n = t[i];
      if (n) {
        n.sort(function(l, u) {
          return l - u;
        });
        for (var a = null, o = 1; o < n.length; ++o) {
          var s = n[o] - n[o - 1];
          s > 0 && (a = a === null ? s : Math.min(a, s));
        }
        e[i] = a;
      }
    }
  return e;
}
function T0(r) {
  var t = BM(r), e = [];
  return T(r, function(i) {
    var n = i.coordinateSystem, a = n.getBaseAxis(), o = a.getExtent(), s;
    if (a.type === "category")
      s = a.getBandWidth();
    else if (a.type === "value" || a.type === "time") {
      var l = a.dim + "_" + a.index, u = t[l], f = Math.abs(o[1] - o[0]), h = a.scale.getExtent(), c = Math.abs(h[1] - h[0]);
      s = u ? f / c * u : f;
    } else {
      var v = i.getData();
      s = Math.abs(o[1] - o[0]) / v.count();
    }
    var p = Mt(i.get("barWidth"), s), g = Mt(i.get("barMaxWidth"), s), d = Mt(
      // barMinWidth by default is 0.5 / 1 in cartesian. Because in value axis,
      // the auto-calculated bar width might be less than 0.5 / 1.
      i.get("barMinWidth") || (M0(i) ? 0.5 : 1),
      s
    ), y = i.get("barGap"), m = i.get("barCategoryGap");
    e.push({
      bandWidth: s,
      barWidth: p,
      barMaxWidth: g,
      barMinWidth: d,
      barGap: y,
      barCategoryGap: m,
      axisKey: jh(a),
      stackId: w0(i)
    });
  }), zM(e);
}
function zM(r) {
  var t = {};
  T(r, function(i, n) {
    var a = i.axisKey, o = i.bandWidth, s = t[a] || {
      bandWidth: o,
      remainedWidth: o,
      autoWidthCount: 0,
      categoryGap: null,
      gap: "20%",
      stacks: {}
    }, l = s.stacks;
    t[a] = s;
    var u = i.stackId;
    l[u] || s.autoWidthCount++, l[u] = l[u] || {
      width: 0,
      maxWidth: 0
    };
    var f = i.barWidth;
    f && !l[u].width && (l[u].width = f, f = Math.min(s.remainedWidth, f), s.remainedWidth -= f);
    var h = i.barMaxWidth;
    h && (l[u].maxWidth = h);
    var c = i.barMinWidth;
    c && (l[u].minWidth = c);
    var v = i.barGap;
    v != null && (s.gap = v);
    var p = i.barCategoryGap;
    p != null && (s.categoryGap = p);
  });
  var e = {};
  return T(t, function(i, n) {
    e[n] = {};
    var a = i.stacks, o = i.bandWidth, s = i.categoryGap;
    if (s == null) {
      var l = ct(a).length;
      s = Math.max(35 - l * 4, 15) + "%";
    }
    var u = Mt(s, o), f = Mt(i.gap, 1), h = i.remainedWidth, c = i.autoWidthCount, v = (h - u) / (c + (c - 1) * f);
    v = Math.max(v, 0), T(a, function(y) {
      var m = y.maxWidth, _ = y.minWidth;
      if (y.width) {
        var S = y.width;
        m && (S = Math.min(S, m)), _ && (S = Math.max(S, _)), y.width = S, h -= S + f * S, c--;
      } else {
        var S = v;
        m && m < S && (S = Math.min(m, h)), _ && _ > S && (S = _), S !== v && (y.width = S, h -= S + f * S, c--);
      }
    }), v = (h - u) / (c + (c - 1) * f), v = Math.max(v, 0);
    var p = 0, g;
    T(a, function(y, m) {
      y.width || (y.width = v), g = y, p += y.width * (1 + f);
    }), g && (p -= g.width * f);
    var d = -p / 2;
    T(a, function(y, m) {
      e[n][m] = e[n][m] || {
        bandWidth: o,
        offset: d,
        width: y.width
      }, d += y.width * (1 + f);
    });
  }), e;
}
function FM(r, t, e) {
  if (r && t) {
    var i = r[jh(t)];
    return i;
  }
}
function VM(r, t) {
  var e = x0(r, t), i = T0(e);
  T(e, function(n) {
    var a = n.getData(), o = n.coordinateSystem, s = o.getBaseAxis(), l = w0(n), u = i[jh(s)][l], f = u.offset, h = u.width;
    a.setLayout({
      bandWidth: u.bandWidth,
      offset: f,
      size: h
    });
  });
}
function HM(r) {
  return {
    seriesType: r,
    plan: Fh(),
    reset: function(t) {
      if (C0(t)) {
        var e = t.getData(), i = t.coordinateSystem, n = i.getBaseAxis(), a = i.getOtherAxis(n), o = e.getDimensionIndex(e.mapDimension(a.dim)), s = e.getDimensionIndex(e.mapDimension(n.dim)), l = t.get("showBackground", !0), u = e.mapDimension(a.dim), f = e.getCalculationInfo("stackResultDimension"), h = Ir(e, u) && !!e.getCalculationInfo("stackedOnSeries"), c = a.isHorizontal(), v = GM(n, a), p = M0(t), g = t.get("barMinHeight") || 0, d = f && e.getDimensionIndex(f), y = e.getLayout("size"), m = e.getLayout("offset");
        return {
          progress: function(_, S) {
            for (var w = _.count, b = p && tr(w * 3), x = p && l && tr(w * 3), M = p && tr(w), D = i.master.getRect(), A = c ? D.width : D.height, C, I = S.getStore(), L = 0; (C = _.next()) != null; ) {
              var P = I.get(h ? d : o, C), R = I.get(s, C), E = v, G = void 0;
              h && (G = +P - I.get(o, C));
              var N = void 0, B = void 0, W = void 0, K = void 0;
              if (c) {
                var tt = i.dataToPoint([P, R]);
                if (h) {
                  var lt = i.dataToPoint([G, R]);
                  E = lt[0];
                }
                N = E, B = tt[1] + m, W = tt[0] - E, K = y, Math.abs(W) < g && (W = (W < 0 ? -1 : 1) * g);
              } else {
                var tt = i.dataToPoint([R, P]);
                if (h) {
                  var lt = i.dataToPoint([R, G]);
                  E = lt[1];
                }
                N = tt[0] + m, B = E, W = y, K = tt[1] - E, Math.abs(K) < g && (K = (K <= 0 ? -1 : 1) * g);
              }
              p ? (b[L] = N, b[L + 1] = B, b[L + 2] = c ? W : K, x && (x[L] = c ? D.x : N, x[L + 1] = c ? B : D.y, x[L + 2] = A), M[C] = C) : S.setItemLayout(C, {
                x: N,
                y: B,
                width: W,
                height: K
              }), L += 3;
            }
            p && S.setLayout({
              largePoints: b,
              largeDataIndices: M,
              largeBackgroundPoints: x,
              valueAxisHorizontal: c
            });
          }
        };
      }
    }
  };
}
function C0(r) {
  return r.coordinateSystem && r.coordinateSystem.type === "cartesian2d";
}
function M0(r) {
  return r.pipelineContext && r.pipelineContext.large;
}
function GM(r, t) {
  var e = t.model.get("startValue");
  return e || (e = 0), t.toGlobalCoord(t.dataToCoord(t.type === "log" ? e > 0 ? e : 1 : e));
}
var WM = function(r, t, e, i) {
  for (; e < i; ) {
    var n = e + i >>> 1;
    r[n][1] < t ? e = n + 1 : i = n;
  }
  return e;
}, D0 = (
  /** @class */
  (function(r) {
    F(t, r);
    function t(e) {
      var i = r.call(this, e) || this;
      return i.type = "time", i;
    }
    return t.prototype.getLabel = function(e) {
      var i = this.getSetting("useUTC");
      return Pa(e.value, Lc[hx($i(this._minLevelUnit))] || Lc.second, i, this.getSetting("locale"));
    }, t.prototype.getFormattedLabel = function(e, i, n) {
      var a = this.getSetting("useUTC"), o = this.getSetting("locale");
      return vx(e, i, n, o, a);
    }, t.prototype.getTicks = function() {
      var e = this._interval, i = this._extent, n = [];
      if (!e)
        return n;
      n.push({
        value: i[0],
        level: 0
      });
      var a = this.getSetting("useUTC"), o = KM(this._minLevelUnit, this._approxInterval, a, i);
      return n = n.concat(o), n.push({
        value: i[1],
        level: 0
      }), n;
    }, t.prototype.calcNiceExtent = function(e) {
      var i = this._extent;
      if (i[0] === i[1] && (i[0] -= ce, i[1] += ce), i[1] === -1 / 0 && i[0] === 1 / 0) {
        var n = /* @__PURE__ */ new Date();
        i[1] = +new Date(n.getFullYear(), n.getMonth(), n.getDate()), i[0] = i[1] - ce;
      }
      this.calcNiceTicks(e.splitNumber, e.minInterval, e.maxInterval);
    }, t.prototype.calcNiceTicks = function(e, i, n) {
      e = e || 10;
      var a = this._extent, o = a[1] - a[0];
      this._approxInterval = o / e, i != null && this._approxInterval < i && (this._approxInterval = i), n != null && this._approxInterval > n && (this._approxInterval = n);
      var s = ho.length, l = Math.min(WM(ho, this._approxInterval, 0, s), s - 1);
      this._interval = ho[l][1], this._minLevelUnit = ho[Math.max(l - 1, 0)][0];
    }, t.prototype.parse = function(e) {
      return vt(e) ? e : +pe(e);
    }, t.prototype.contain = function(e) {
      return js(this.parse(e), this._extent);
    }, t.prototype.normalize = function(e) {
      return tl(this.parse(e), this._extent);
    }, t.prototype.scale = function(e) {
      return el(e, this._extent);
    }, t.type = "time", t;
  })(ln)
), ho = [
  // Format                           interval
  ["second", Mh],
  ["minute", Dh],
  ["hour", $n],
  ["quarter-day", $n * 6],
  ["half-day", $n * 12],
  ["day", ce * 1.2],
  ["half-week", ce * 3.5],
  ["week", ce * 7],
  ["month", ce * 31],
  ["quarter", ce * 95],
  ["half-year", Ic / 2],
  ["year", Ic]
  // 1Y
];
function UM(r, t, e, i) {
  var n = pe(t), a = pe(e), o = function(p) {
    return Pc(n, p, i) === Pc(a, p, i);
  }, s = function() {
    return o("year");
  }, l = function() {
    return s() && o("month");
  }, u = function() {
    return l() && o("day");
  }, f = function() {
    return u() && o("hour");
  }, h = function() {
    return f() && o("minute");
  }, c = function() {
    return h() && o("second");
  }, v = function() {
    return c() && o("millisecond");
  };
  switch (r) {
    case "year":
      return s();
    case "month":
      return l();
    case "day":
      return u();
    case "hour":
      return f();
    case "minute":
      return h();
    case "second":
      return c();
    case "millisecond":
      return v();
  }
}
function YM(r, t) {
  return r /= ce, r > 16 ? 16 : r > 7.5 ? 7 : r > 3.5 ? 4 : r > 1.5 ? 2 : 1;
}
function XM(r) {
  var t = 30 * ce;
  return r /= t, r > 6 ? 6 : r > 3 ? 3 : r > 2 ? 2 : 1;
}
function $M(r) {
  return r /= $n, r > 12 ? 12 : r > 6 ? 6 : r > 3.5 ? 4 : r > 2 ? 2 : 1;
}
function Fp(r, t) {
  return r /= t ? Dh : Mh, r > 30 ? 30 : r > 20 ? 20 : r > 15 ? 15 : r > 10 ? 10 : r > 5 ? 5 : r > 2 ? 2 : 1;
}
function ZM(r) {
  return fh(r, !0);
}
function qM(r, t, e) {
  var i = new Date(r);
  switch ($i(t)) {
    case "year":
    case "month":
      i[Jy(e)](0);
    case "day":
      i[jy(e)](1);
    case "hour":
      i[tm(e)](0);
    case "minute":
      i[em(e)](0);
    case "second":
      i[rm(e)](0), i[im(e)](0);
  }
  return i.getTime();
}
function KM(r, t, e, i) {
  var n = 1e4, a = Ky, o = 0;
  function s(A, C, I, L, P, R, E) {
    for (var G = new Date(C), N = C, B = G[L](); N < I && N <= i[1]; )
      E.push({
        value: N
      }), B += A, G[P](B), N = G.getTime();
    E.push({
      value: N,
      notAdd: !0
    });
  }
  function l(A, C, I) {
    var L = [], P = !C.length;
    if (!UM($i(A), i[0], i[1], e)) {
      P && (C = [{
        // TODO Optimize. Not include so may ticks.
        value: qM(new Date(i[0]), A, e)
      }, {
        value: i[1]
      }]);
      for (var R = 0; R < C.length - 1; R++) {
        var E = C[R].value, G = C[R + 1].value;
        if (E !== G) {
          var N = void 0, B = void 0, W = void 0, K = !1;
          switch (A) {
            case "year":
              N = Math.max(1, Math.round(t / ce / 365)), B = Ah(e), W = cx(e);
              break;
            case "half-year":
            case "quarter":
            case "month":
              N = XM(t), B = Zi(e), W = Jy(e);
              break;
            case "week":
            // PENDING If week is added. Ignore day.
            case "half-week":
            case "day":
              N = YM(t), B = Gs(e), W = jy(e), K = !0;
              break;
            case "half-day":
            case "quarter-day":
            case "hour":
              N = $M(t), B = fa(e), W = tm(e);
              break;
            case "minute":
              N = Fp(t, !0), B = Ws(e), W = em(e);
              break;
            case "second":
              N = Fp(t, !1), B = Us(e), W = rm(e);
              break;
            case "millisecond":
              N = ZM(t), B = Ys(e), W = im(e);
              break;
          }
          s(N, E, G, B, W, K, L), A === "year" && I.length > 1 && R === 0 && I.unshift({
            value: I[0].value - N
          });
        }
      }
      for (var R = 0; R < L.length; R++)
        I.push(L[R]);
      return L;
    }
  }
  for (var u = [], f = [], h = 0, c = 0, v = 0; v < a.length && o++ < n; ++v) {
    var p = $i(a[v]);
    if (fx(a[v])) {
      l(a[v], u[u.length - 1] || [], f);
      var g = a[v + 1] ? $i(a[v + 1]) : null;
      if (p !== g) {
        if (f.length) {
          c = h, f.sort(function(A, C) {
            return A.value - C.value;
          });
          for (var d = [], y = 0; y < f.length; ++y) {
            var m = f[y].value;
            (y === 0 || f[y - 1].value !== m) && (d.push(f[y]), m >= i[0] && m <= i[1] && h++);
          }
          var _ = (i[1] - i[0]) / t;
          if (h > _ * 1.5 && c > _ / 1.5 || (u.push(d), h > _ || r === a[v]))
            break;
        }
        f = [];
      }
    }
  }
  for (var S = xt(z(u, function(A) {
    return xt(A, function(C) {
      return C.value >= i[0] && C.value <= i[1] && !C.notAdd;
    });
  }), function(A) {
    return A.length > 0;
  }), w = [], b = S.length - 1, v = 0; v < S.length; ++v)
    for (var x = S[v], M = 0; M < x.length; ++M)
      w.push({
        value: x[M].value,
        level: b - v
      });
  w.sort(function(A, C) {
    return A.value - C.value;
  });
  for (var D = [], v = 0; v < w.length; ++v)
    (v === 0 || w[v].value !== w[v - 1].value) && D.push(w[v]);
  return D;
}
qe.registerClass(D0);
var Vp = qe.prototype, Qn = ln.prototype, QM = St, JM = Math.floor, jM = Math.ceil, vo = Math.pow, we = Math.log, tv = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = "log", e.base = 10, e._originalScale = new ln(), e._interval = 0, e;
    }
    return t.prototype.getTicks = function(e) {
      var i = this._originalScale, n = this._extent, a = i.getExtent(), o = Qn.getTicks.call(this, e);
      return z(o, function(s) {
        var l = s.value, u = St(vo(this.base, l));
        return u = l === n[0] && this._fixMin ? co(u, a[0]) : u, u = l === n[1] && this._fixMax ? co(u, a[1]) : u, {
          value: u
        };
      }, this);
    }, t.prototype.setExtent = function(e, i) {
      var n = we(this.base);
      e = we(Math.max(0, e)) / n, i = we(Math.max(0, i)) / n, Qn.setExtent.call(this, e, i);
    }, t.prototype.getExtent = function() {
      var e = this.base, i = Vp.getExtent.call(this);
      i[0] = vo(e, i[0]), i[1] = vo(e, i[1]);
      var n = this._originalScale, a = n.getExtent();
      return this._fixMin && (i[0] = co(i[0], a[0])), this._fixMax && (i[1] = co(i[1], a[1])), i;
    }, t.prototype.unionExtent = function(e) {
      this._originalScale.unionExtent(e);
      var i = this.base;
      e[0] = we(e[0]) / we(i), e[1] = we(e[1]) / we(i), Vp.unionExtent.call(this, e);
    }, t.prototype.unionExtentFromData = function(e, i) {
      this.unionExtent(e.getApproximateExtent(i));
    }, t.prototype.calcNiceTicks = function(e) {
      e = e || 10;
      var i = this._extent, n = i[1] - i[0];
      if (!(n === 1 / 0 || n <= 0)) {
        var a = ty(n), o = e / n * a;
        for (o <= 0.5 && (a *= 10); !isNaN(a) && Math.abs(a) < 1 && Math.abs(a) > 0; )
          a *= 10;
        var s = [St(jM(i[0] / a) * a), St(JM(i[1] / a) * a)];
        this._interval = a, this._niceExtent = s;
      }
    }, t.prototype.calcNiceExtent = function(e) {
      Qn.calcNiceExtent.call(this, e), this._fixMin = e.fixMin, this._fixMax = e.fixMax;
    }, t.prototype.parse = function(e) {
      return e;
    }, t.prototype.contain = function(e) {
      return e = we(e) / we(this.base), js(e, this._extent);
    }, t.prototype.normalize = function(e) {
      return e = we(e) / we(this.base), tl(e, this._extent);
    }, t.prototype.scale = function(e) {
      return e = el(e, this._extent), vo(this.base, e);
    }, t.type = "log", t;
  })(qe)
), A0 = tv.prototype;
A0.getMinorTicks = Qn.getMinorTicks;
A0.getLabel = Qn.getLabel;
function co(r, t) {
  return QM(r, De(t));
}
qe.registerClass(tv);
var tD = (
  /** @class */
  (function() {
    function r(t, e, i) {
      this._prepareParams(t, e, i);
    }
    return r.prototype._prepareParams = function(t, e, i) {
      i[1] < i[0] && (i = [NaN, NaN]), this._dataMin = i[0], this._dataMax = i[1];
      var n = this._isOrdinal = t.type === "ordinal";
      this._needCrossZero = t.type === "interval" && e.getNeedCrossZero && e.getNeedCrossZero();
      var a = e.get("min", !0);
      a == null && (a = e.get("startValue", !0));
      var o = this._modelMinRaw = a;
      X(o) ? this._modelMinNum = po(t, o({
        min: i[0],
        max: i[1]
      })) : o !== "dataMin" && (this._modelMinNum = po(t, o));
      var s = this._modelMaxRaw = e.get("max", !0);
      if (X(s) ? this._modelMaxNum = po(t, s({
        min: i[0],
        max: i[1]
      })) : s !== "dataMax" && (this._modelMaxNum = po(t, s)), n)
        this._axisDataLen = e.getCategories().length;
      else {
        var l = e.get("boundaryGap"), u = O(l) ? l : [l || 0, l || 0];
        typeof u[0] == "boolean" || typeof u[1] == "boolean" ? this._boundaryGapInner = [0, 0] : this._boundaryGapInner = [Ue(u[0], 1), Ue(u[1], 1)];
      }
    }, r.prototype.calculate = function() {
      var t = this._isOrdinal, e = this._dataMin, i = this._dataMax, n = this._axisDataLen, a = this._boundaryGapInner, o = t ? null : i - e || Math.abs(e), s = this._modelMinRaw === "dataMin" ? e : this._modelMinNum, l = this._modelMaxRaw === "dataMax" ? i : this._modelMaxNum, u = s != null, f = l != null;
      s == null && (s = t ? n ? 0 : NaN : e - a[0] * o), l == null && (l = t ? n ? n - 1 : NaN : i + a[1] * o), (s == null || !isFinite(s)) && (s = NaN), (l == null || !isFinite(l)) && (l = NaN);
      var h = Jn(s) || Jn(l) || t && !n;
      this._needCrossZero && (s > 0 && l > 0 && !u && (s = 0), s < 0 && l < 0 && !f && (l = 0));
      var c = this._determinedMin, v = this._determinedMax;
      return c != null && (s = c, u = !0), v != null && (l = v, f = !0), {
        min: s,
        max: l,
        minFixed: u,
        maxFixed: f,
        isBlank: h
      };
    }, r.prototype.modifyDataMinMax = function(t, e) {
      this[rD[t]] = e;
    }, r.prototype.setDeterminedMinMax = function(t, e) {
      var i = eD[t];
      this[i] = e;
    }, r.prototype.freeze = function() {
      this.frozen = !0;
    }, r;
  })()
), eD = {
  min: "_determinedMin",
  max: "_determinedMax"
}, rD = {
  min: "_dataMin",
  max: "_dataMax"
};
function iD(r, t, e) {
  var i = r.rawExtentInfo;
  return i || (i = new tD(r, t, e), r.rawExtentInfo = i, i);
}
function po(r, t) {
  return t == null ? null : Jn(t) ? NaN : r.parse(t);
}
function I0(r, t) {
  var e = r.type, i = iD(r, t, r.getExtent()).calculate();
  r.setBlank(i.isBlank);
  var n = i.min, a = i.max, o = t.ecModel;
  if (o && e === "time") {
    var s = x0("bar", o), l = !1;
    if (T(s, function(h) {
      l = l || h.getBaseAxis() === t.axis;
    }), l) {
      var u = T0(s), f = nD(n, a, t, u);
      n = f.min, a = f.max;
    }
  }
  return {
    extent: [n, a],
    // "fix" means "fixed", the value should not be
    // changed in the subsequent steps.
    fixMin: i.minFixed,
    fixMax: i.maxFixed
  };
}
function nD(r, t, e, i) {
  var n = e.axis.getExtent(), a = Math.abs(n[1] - n[0]), o = FM(i, e.axis);
  if (o === void 0)
    return {
      min: r,
      max: t
    };
  var s = 1 / 0;
  T(o, function(v) {
    s = Math.min(v.offset, s);
  });
  var l = -1 / 0;
  T(o, function(v) {
    l = Math.max(v.offset + v.width, l);
  }), s = Math.abs(s), l = Math.abs(l);
  var u = s + l, f = t - r, h = 1 - (s + l) / a, c = f / h - f;
  return t += c * (l / u), r -= c * (s / u), {
    min: r,
    max: t
  };
}
function If(r, t) {
  var e = t, i = I0(r, e), n = i.extent, a = e.get("splitNumber");
  r instanceof tv && (r.base = e.get("logBase"));
  var o = r.type, s = e.get("interval"), l = o === "interval" || o === "time";
  r.setExtent(n[0], n[1]), r.calcNiceExtent({
    splitNumber: a,
    fixMin: i.fixMin,
    fixMax: i.fixMax,
    minInterval: l ? e.get("minInterval") : null,
    maxInterval: l ? e.get("maxInterval") : null
  }), s != null && r.setInterval && r.setInterval(s);
}
function L0(r, t) {
  if (t = t || r.get("type"), t)
    switch (t) {
      // Buildin scale
      case "category":
        return new Jh({
          ordinalMeta: r.getOrdinalMeta ? r.getOrdinalMeta() : r.getCategories(),
          extent: [1 / 0, -1 / 0]
        });
      case "time":
        return new D0({
          locale: r.ecModel.getLocaleModel(),
          useUTC: r.ecModel.get("useUTC")
        });
      default:
        return new (qe.getClass(t) || ln)();
    }
}
function aD(r) {
  var t = r.scale.getExtent(), e = t[0], i = t[1];
  return !(e > 0 && i > 0 || e < 0 && i < 0);
}
function un(r) {
  var t = r.getLabelModel().get("formatter"), e = r.type === "category" ? r.scale.getExtent()[0] : null;
  return r.scale.type === "time" ? /* @__PURE__ */ (function(i) {
    return function(n, a) {
      return r.scale.getFormattedLabel(n, a, i);
    };
  })(t) : V(t) ? /* @__PURE__ */ (function(i) {
    return function(n) {
      var a = r.scale.getLabel(n), o = i.replace("{value}", a ?? "");
      return o;
    };
  })(t) : X(t) ? /* @__PURE__ */ (function(i) {
    return function(n, a) {
      return e != null && (a = n.value - e), i(ev(r, n), a, n.level != null ? {
        level: n.level
      } : null);
    };
  })(t) : function(i) {
    return r.scale.getLabel(i);
  };
}
function ev(r, t) {
  return r.type === "category" ? r.scale.getLabel(t) : t.value;
}
function oD(r) {
  var t = r.model, e = r.scale;
  if (!(!t.get(["axisLabel", "show"]) || e.isBlank())) {
    var i, n, a = e.getExtent();
    e instanceof Jh ? n = e.count() : (i = e.getTicks(), n = i.length);
    var o = r.getLabelModel(), s = un(r), l, u = 1;
    n > 40 && (u = Math.ceil(n / 40));
    for (var f = 0; f < n; f += u) {
      var h = i ? i[f] : {
        value: a[0] + f
      }, c = s(h, f), v = o.getTextRect(c), p = sD(v, o.get("rotate") || 0);
      l ? l.union(p) : l = p;
    }
    return l;
  }
}
function sD(r, t) {
  var e = t * Math.PI / 180, i = r.width, n = r.height, a = i * Math.abs(Math.cos(e)) + Math.abs(n * Math.sin(e)), o = i * Math.abs(Math.sin(e)) + Math.abs(n * Math.cos(e)), s = new it(r.x, r.y, a, o);
  return s;
}
function rv(r) {
  var t = r.get("interval");
  return t ?? "auto";
}
function P0(r) {
  return r.type === "category" && rv(r.getLabelModel()) === 0;
}
function lD(r, t) {
  var e = {};
  return T(r.mapDimensionsAll(t), function(i) {
    e[Qh(r, i)] = !0;
  }), ct(e);
}
var R0 = (
  /** @class */
  (function() {
    function r() {
    }
    return r.prototype.getNeedCrossZero = function() {
      var t = this.option;
      return !t.scale;
    }, r.prototype.getCoordSysModel = function() {
    }, r;
  })()
);
function uD(r) {
  return sn(null, r);
}
var fD = {
  isDimensionStacked: Ir,
  enableDataStack: _0,
  getStackedDimension: Qh
};
function hD(r, t) {
  var e = t;
  t instanceof pt || (e = new pt(t));
  var i = L0(e);
  return i.setExtent(r[0], r[1]), If(i, e), i;
}
function vD(r) {
  ie(r, R0);
}
function cD(r, t) {
  return t = t || {}, re(r, null, null, t.state !== "normal");
}
const pD = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createDimensions: _M,
  createList: uD,
  createScale: hD,
  createSymbol: ge,
  createTextStyle: cD,
  dataStack: fD,
  enableHoverEmphasis: ts,
  getECData: J,
  getLayoutRect: Ar,
  mixinAxisModelCommonMethods: vD
}, Symbol.toStringTag, { value: "Module" }));
var Hp = [], dD = {
  registerPreprocessor: $h,
  registerProcessor: Zh,
  registerPostInit: s0,
  registerPostUpdate: l0,
  registerUpdateLifecycle: Js,
  registerAction: _i,
  registerCoordinateSystem: u0,
  registerLayout: f0,
  registerVisual: Lr,
  registerTransform: v0,
  registerLoading: Kh,
  registerMap: h0,
  registerImpl: kC,
  PRIORITY: Qm,
  ComponentModel: rt,
  ComponentView: kt,
  SeriesModel: Ut,
  ChartView: Et,
  // TODO Use ComponentModel and SeriesModel instead of Constructor
  registerComponentModel: function(r) {
    rt.registerClass(r);
  },
  registerComponentView: function(r) {
    kt.registerClass(r);
  },
  registerSeriesModel: function(r) {
    Ut.registerClass(r);
  },
  registerChartView: function(r) {
    Et.registerClass(r);
  },
  registerSubTypeDefaulter: function(r, t) {
    rt.registerSubTypeDefaulter(r, t);
  },
  registerPainter: function(r, t) {
    qg(r, t);
  }
};
function ye(r) {
  if (O(r)) {
    T(r, function(t) {
      ye(t);
    });
    return;
  }
  nt(Hp, r) >= 0 || (Hp.push(r), X(r) && (r = {
    install: r
  }), r.install(dD));
}
var gD = 1e-8;
function Gp(r, t) {
  return Math.abs(r - t) < gD;
}
function Wp(r, t, e) {
  var i = 0, n = r[0];
  if (!n)
    return !1;
  for (var a = 1; a < r.length; a++) {
    var o = r[a];
    i += je(n[0], n[1], o[0], o[1], t, e), n = o;
  }
  var s = r[0];
  return (!Gp(n[0], s[0]) || !Gp(n[1], s[1])) && (i += je(n[0], n[1], s[0], s[1], t, e)), i !== 0;
}
var yD = [];
function su(r, t) {
  for (var e = 0; e < r.length; e++)
    Vt(r[e], r[e], t);
}
function Up(r, t, e, i) {
  for (var n = 0; n < r.length; n++) {
    var a = r[n];
    i && (a = i.project(a)), a && isFinite(a[0]) && isFinite(a[1]) && (dr(t, t, a), gr(e, e, a));
  }
}
function mD(r) {
  for (var t = 0, e = 0, i = 0, n = r.length, a = r[n - 1][0], o = r[n - 1][1], s = 0; s < n; s++) {
    var l = r[s][0], u = r[s][1], f = a * u - l * o;
    t += f, e += (a + l) * f, i += (o + u) * f, a = l, o = u;
  }
  return t ? [e / t / 3, i / t / 3, t] : [r[0][0] || 0, r[0][1] || 0];
}
var E0 = (
  /** @class */
  (function() {
    function r(t) {
      this.name = t;
    }
    return r.prototype.setCenter = function(t) {
      this._center = t;
    }, r.prototype.getCenter = function() {
      var t = this._center;
      return t || (t = this._center = this.calcCenter()), t;
    }, r;
  })()
), Yp = (
  /** @class */
  /* @__PURE__ */ (function() {
    function r(t, e) {
      this.type = "polygon", this.exterior = t, this.interiors = e;
    }
    return r;
  })()
), Xp = (
  /** @class */
  /* @__PURE__ */ (function() {
    function r(t) {
      this.type = "linestring", this.points = t;
    }
    return r;
  })()
), _D = (
  /** @class */
  (function(r) {
    F(t, r);
    function t(e, i, n) {
      var a = r.call(this, e) || this;
      return a.type = "geoJSON", a.geometries = i, a._center = n && [n[0], n[1]], a;
    }
    return t.prototype.calcCenter = function() {
      for (var e = this.geometries, i, n = 0, a = 0; a < e.length; a++) {
        var o = e[a], s = o.exterior, l = s && s.length;
        l > n && (i = o, n = l);
      }
      if (i)
        return mD(i.exterior);
      var u = this.getBoundingRect();
      return [u.x + u.width / 2, u.y + u.height / 2];
    }, t.prototype.getBoundingRect = function(e) {
      var i = this._rect;
      if (i && !e)
        return i;
      var n = [1 / 0, 1 / 0], a = [-1 / 0, -1 / 0], o = this.geometries;
      return T(o, function(s) {
        s.type === "polygon" ? Up(s.exterior, n, a, e) : T(s.points, function(l) {
          Up(l, n, a, e);
        });
      }), isFinite(n[0]) && isFinite(n[1]) && isFinite(a[0]) && isFinite(a[1]) || (n[0] = n[1] = a[0] = a[1] = 0), i = new it(n[0], n[1], a[0] - n[0], a[1] - n[1]), e || (this._rect = i), i;
    }, t.prototype.contain = function(e) {
      var i = this.getBoundingRect(), n = this.geometries;
      if (!i.contain(e[0], e[1]))
        return !1;
      t: for (var a = 0, o = n.length; a < o; a++) {
        var s = n[a];
        if (s.type === "polygon") {
          var l = s.exterior, u = s.interiors;
          if (Wp(l, e[0], e[1])) {
            for (var f = 0; f < (u ? u.length : 0); f++)
              if (Wp(u[f], e[0], e[1]))
                continue t;
            return !0;
          }
        }
      }
      return !1;
    }, t.prototype.transformTo = function(e, i, n, a) {
      var o = this.getBoundingRect(), s = o.width / o.height;
      n ? a || (a = n / s) : n = s * a;
      for (var l = new it(e, i, n, a), u = o.calculateTransform(l), f = this.geometries, h = 0; h < f.length; h++) {
        var c = f[h];
        c.type === "polygon" ? (su(c.exterior, u), T(c.interiors, function(v) {
          su(v, u);
        })) : T(c.points, function(v) {
          su(v, u);
        });
      }
      o = this._rect, o.copy(l), this._center = [o.x + o.width / 2, o.y + o.height / 2];
    }, t.prototype.cloneShallow = function(e) {
      e == null && (e = this.name);
      var i = new t(e, this.geometries, this._center);
      return i._rect = this._rect, i.transformTo = null, i;
    }, t;
  })(E0)
);
(function(r) {
  F(t, r);
  function t(e, i) {
    var n = r.call(this, e) || this;
    return n.type = "geoSVG", n._elOnlyForCalculate = i, n;
  }
  return t.prototype.calcCenter = function() {
    for (var e = this._elOnlyForCalculate, i = e.getBoundingRect(), n = [i.x + i.width / 2, i.y + i.height / 2], a = ba(yD), o = e; o && !o.isGeoSVGGraphicRoot; )
      br(a, o.getLocalTransform(), a), o = o.parent;
    return wa(a, a), Vt(n, n, a), n;
  }, t;
})(E0);
function SD(r) {
  if (!r.UTF8Encoding)
    return r;
  var t = r, e = t.UTF8Scale;
  e == null && (e = 1024);
  var i = t.features;
  return T(i, function(n) {
    var a = n.geometry, o = a.encodeOffsets, s = a.coordinates;
    if (o)
      switch (a.type) {
        case "LineString":
          a.coordinates = O0(s, o, e);
          break;
        case "Polygon":
          lu(s, o, e);
          break;
        case "MultiLineString":
          lu(s, o, e);
          break;
        case "MultiPolygon":
          T(s, function(l, u) {
            return lu(l, o[u], e);
          });
      }
  }), t.UTF8Encoding = !1, t;
}
function lu(r, t, e) {
  for (var i = 0; i < r.length; i++)
    r[i] = O0(r[i], t[i], e);
}
function O0(r, t, e) {
  for (var i = [], n = t[0], a = t[1], o = 0; o < r.length; o += 2) {
    var s = r.charCodeAt(o) - 64, l = r.charCodeAt(o + 1) - 64;
    s = s >> 1 ^ -(s & 1), l = l >> 1 ^ -(l & 1), s += n, l += a, n = s, a = l, i.push([s / e, l / e]);
  }
  return i;
}
function $p(r, t) {
  return r = SD(r), z(xt(r.features, function(e) {
    return e.geometry && e.properties && e.geometry.coordinates.length > 0;
  }), function(e) {
    var i = e.properties, n = e.geometry, a = [];
    switch (n.type) {
      case "Polygon":
        var o = n.coordinates;
        a.push(new Yp(o[0], o.slice(1)));
        break;
      case "MultiPolygon":
        T(n.coordinates, function(l) {
          l[0] && a.push(new Yp(l[0], l.slice(1)));
        });
        break;
      case "LineString":
        a.push(new Xp([n.coordinates]));
        break;
      case "MultiLineString":
        a.push(new Xp(n.coordinates));
    }
    var s = new _D(i[t || "name"], a, i.cp);
    return s.properties = i, s;
  });
}
const bD = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  MAX_SAFE_INTEGER: AS,
  asc: lh,
  getPercentWithPrecision: CS,
  getPixelPrecision: jg,
  getPrecision: De,
  getPrecisionSafe: Jg,
  isNumeric: ey,
  isRadianAroundZero: ia,
  linearMap: Ye,
  nice: fh,
  numericToNumber: na,
  parseDate: pe,
  quantile: LS,
  quantity: ty,
  quantityExponent: Ts,
  reformIntervals: Ju,
  remRadian: uh,
  round: St
}, Symbol.toStringTag, { value: "Module" })), wD = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  format: Pa,
  parse: pe
}, Symbol.toStringTag, { value: "Module" })), xD = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Arc: La,
  BezierCurve: Ia,
  BoundingRect: it,
  Circle: Da,
  CompoundPath: Ry,
  Ellipse: Ps,
  Group: gt,
  Image: ke,
  IncrementalDisplayable: ky,
  Line: Xe,
  LinearGradient: Os,
  Polygon: Aa,
  Polyline: Es,
  RadialGradient: Oy,
  Rect: dt,
  Ring: Rs,
  Sector: mi,
  Text: mt,
  clipPointsByRect: Uy,
  clipRectByRect: Yy,
  createIcon: Ns,
  extendPath: zy,
  extendShape: By,
  getShapeClass: Fy,
  getTransform: Xn,
  initProps: Oe,
  makeImage: bh,
  makePath: ks,
  mergePath: Hy,
  registerShape: me,
  resizePath: wh,
  updateProps: Wt
}, Symbol.toStringTag, { value: "Module" })), TD = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  addCommas: Ih,
  capitalFirst: gx,
  encodeHTML: Ft,
  formatTime: dx,
  formatTpl: Ph,
  getTextRect: px,
  getTooltipMarker: nm,
  normalizeCssArray: an,
  toCamelCase: Lh,
  truncateText: ab
}, Symbol.toStringTag, { value: "Module" })), CD = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  bind: Q,
  clone: U,
  curry: ht,
  defaults: at,
  each: T,
  extend: k,
  filter: xt,
  indexOf: nt,
  inherits: qf,
  isArray: O,
  isFunction: X,
  isObject: H,
  isString: V,
  map: z,
  merge: j,
  reduce: We
}, Symbol.toStringTag, { value: "Module" }));
var da = bt();
function k0(r, t) {
  var e = z(t, function(i) {
    return r.scale.parse(i);
  });
  return r.type === "time" && e.length > 0 && (e.sort(), e.unshift(e[0]), e.push(e[e.length - 1])), e;
}
function MD(r) {
  var t = r.getLabelModel().get("customValues");
  if (t) {
    var e = un(r), i = r.scale.getExtent(), n = k0(r, t), a = xt(n, function(o) {
      return o >= i[0] && o <= i[1];
    });
    return {
      labels: z(a, function(o) {
        var s = {
          value: o
        };
        return {
          formattedLabel: e(s),
          rawLabel: r.scale.getLabel(s),
          tickValue: o
        };
      })
    };
  }
  return r.type === "category" ? AD(r) : LD(r);
}
function DD(r, t) {
  var e = r.getTickModel().get("customValues");
  if (e) {
    var i = r.scale.getExtent(), n = k0(r, e);
    return {
      ticks: xt(n, function(a) {
        return a >= i[0] && a <= i[1];
      })
    };
  }
  return r.type === "category" ? ID(r, t) : {
    ticks: z(r.scale.getTicks(), function(a) {
      return a.value;
    })
  };
}
function AD(r) {
  var t = r.getLabelModel(), e = N0(r, t);
  return !t.get("show") || r.scale.isBlank() ? {
    labels: [],
    labelCategoryInterval: e.labelCategoryInterval
  } : e;
}
function N0(r, t) {
  var e = B0(r, "labels"), i = rv(t), n = z0(e, i);
  if (n)
    return n;
  var a, o;
  return X(i) ? a = H0(r, i) : (o = i === "auto" ? PD(r) : i, a = V0(r, o)), F0(e, i, {
    labels: a,
    labelCategoryInterval: o
  });
}
function ID(r, t) {
  var e = B0(r, "ticks"), i = rv(t), n = z0(e, i);
  if (n)
    return n;
  var a, o;
  if ((!t.get("show") || r.scale.isBlank()) && (a = []), X(i))
    a = H0(r, i, !0);
  else if (i === "auto") {
    var s = N0(r, r.getLabelModel());
    o = s.labelCategoryInterval, a = z(s.labels, function(l) {
      return l.tickValue;
    });
  } else
    o = i, a = V0(r, o, !0);
  return F0(e, i, {
    ticks: a,
    tickCategoryInterval: o
  });
}
function LD(r) {
  var t = r.scale.getTicks(), e = un(r);
  return {
    labels: z(t, function(i, n) {
      return {
        level: i.level,
        formattedLabel: e(i, n),
        rawLabel: r.scale.getLabel(i),
        tickValue: i.value
      };
    })
  };
}
function B0(r, t) {
  return da(r)[t] || (da(r)[t] = []);
}
function z0(r, t) {
  for (var e = 0; e < r.length; e++)
    if (r[e].key === t)
      return r[e].value;
}
function F0(r, t, e) {
  return r.push({
    key: t,
    value: e
  }), e;
}
function PD(r) {
  var t = da(r).autoInterval;
  return t ?? (da(r).autoInterval = r.calculateCategoryInterval());
}
function RD(r) {
  var t = ED(r), e = un(r), i = (t.axisRotate - t.labelRotate) / 180 * Math.PI, n = r.scale, a = n.getExtent(), o = n.count();
  if (a[1] - a[0] < 1)
    return 0;
  var s = 1;
  o > 40 && (s = Math.max(1, Math.floor(o / 40)));
  for (var l = a[0], u = r.dataToCoord(l + 1) - r.dataToCoord(l), f = Math.abs(u * Math.cos(i)), h = Math.abs(u * Math.sin(i)), c = 0, v = 0; l <= a[1]; l += s) {
    var p = 0, g = 0, d = oh(e({
      value: l
    }), t.font, "center", "top");
    p = d.width * 1.3, g = d.height * 1.3, c = Math.max(c, p, 7), v = Math.max(v, g, 7);
  }
  var y = c / f, m = v / h;
  isNaN(y) && (y = 1 / 0), isNaN(m) && (m = 1 / 0);
  var _ = Math.max(0, Math.floor(Math.min(y, m))), S = da(r.model), w = r.getExtent(), b = S.lastAutoInterval, x = S.lastTickCount;
  return b != null && x != null && Math.abs(b - _) <= 1 && Math.abs(x - o) <= 1 && b > _ && S.axisExtent0 === w[0] && S.axisExtent1 === w[1] ? _ = b : (S.lastTickCount = o, S.lastAutoInterval = _, S.axisExtent0 = w[0], S.axisExtent1 = w[1]), _;
}
function ED(r) {
  var t = r.getLabelModel();
  return {
    axisRotate: r.getRotate ? r.getRotate() : r.isHorizontal && !r.isHorizontal() ? 90 : 0,
    labelRotate: t.get("rotate") || 0,
    font: t.getFont()
  };
}
function V0(r, t, e) {
  var i = un(r), n = r.scale, a = n.getExtent(), o = r.getLabelModel(), s = [], l = Math.max((t || 0) + 1, 1), u = a[0], f = n.count();
  u !== 0 && l > 1 && f / l > 2 && (u = Math.round(Math.ceil(u / l) * l));
  var h = P0(r), c = o.get("showMinLabel") || h, v = o.get("showMaxLabel") || h;
  c && u !== a[0] && g(a[0]);
  for (var p = u; p <= a[1]; p += l)
    g(p);
  v && p - l !== a[1] && g(a[1]);
  function g(d) {
    var y = {
      value: d
    };
    s.push(e ? d : {
      formattedLabel: i(y),
      rawLabel: n.getLabel(y),
      tickValue: d
    });
  }
  return s;
}
function H0(r, t, e) {
  var i = r.scale, n = un(r), a = [];
  return T(i.getTicks(), function(o) {
    var s = i.getLabel(o), l = o.value;
    t(o.value, s) && a.push(e ? l : {
      formattedLabel: n(o),
      rawLabel: s,
      tickValue: l
    });
  }), a;
}
var Zp = [0, 1], G0 = (
  /** @class */
  (function() {
    function r(t, e, i) {
      this.onBand = !1, this.inverse = !1, this.dim = t, this.scale = e, this._extent = i || [0, 0];
    }
    return r.prototype.contain = function(t) {
      var e = this._extent, i = Math.min(e[0], e[1]), n = Math.max(e[0], e[1]);
      return t >= i && t <= n;
    }, r.prototype.containData = function(t) {
      return this.scale.contain(t);
    }, r.prototype.getExtent = function() {
      return this._extent.slice();
    }, r.prototype.getPixelPrecision = function(t) {
      return jg(t || this.scale.getExtent(), this._extent);
    }, r.prototype.setExtent = function(t, e) {
      var i = this._extent;
      i[0] = t, i[1] = e;
    }, r.prototype.dataToCoord = function(t, e) {
      var i = this._extent, n = this.scale;
      return t = n.normalize(t), this.onBand && n.type === "ordinal" && (i = i.slice(), qp(i, n.count())), Ye(t, Zp, i, e);
    }, r.prototype.coordToData = function(t, e) {
      var i = this._extent, n = this.scale;
      this.onBand && n.type === "ordinal" && (i = i.slice(), qp(i, n.count()));
      var a = Ye(t, i, Zp, e);
      return this.scale.scale(a);
    }, r.prototype.pointToData = function(t, e) {
    }, r.prototype.getTicksCoords = function(t) {
      t = t || {};
      var e = t.tickModel || this.getTickModel(), i = DD(this, e), n = i.ticks, a = z(n, function(s) {
        return {
          coord: this.dataToCoord(this.scale.type === "ordinal" ? this.scale.getRawOrdinalNumber(s) : s),
          tickValue: s
        };
      }, this), o = e.get("alignWithLabel");
      return OD(this, a, o, t.clamp), a;
    }, r.prototype.getMinorTicksCoords = function() {
      if (this.scale.type === "ordinal")
        return [];
      var t = this.model.getModel("minorTick"), e = t.get("splitNumber");
      e > 0 && e < 100 || (e = 5);
      var i = this.scale.getMinorTicks(e), n = z(i, function(a) {
        return z(a, function(o) {
          return {
            coord: this.dataToCoord(o),
            tickValue: o
          };
        }, this);
      }, this);
      return n;
    }, r.prototype.getViewLabels = function() {
      return MD(this).labels;
    }, r.prototype.getLabelModel = function() {
      return this.model.getModel("axisLabel");
    }, r.prototype.getTickModel = function() {
      return this.model.getModel("axisTick");
    }, r.prototype.getBandWidth = function() {
      var t = this._extent, e = this.scale.getExtent(), i = e[1] - e[0] + (this.onBand ? 1 : 0);
      i === 0 && (i = 1);
      var n = Math.abs(t[1] - t[0]);
      return Math.abs(n) / i;
    }, r.prototype.calculateCategoryInterval = function() {
      return RD(this);
    }, r;
  })()
);
function qp(r, t) {
  var e = r[1] - r[0], i = t, n = e / i / 2;
  r[0] += n, r[1] -= n;
}
function OD(r, t, e, i) {
  var n = t.length;
  if (!r.onBand || e || !n)
    return;
  var a = r.getExtent(), o, s;
  if (n === 1)
    t[0].coord = a[0], o = t[1] = {
      coord: a[1],
      tickValue: t[0].tickValue
    };
  else {
    var l = t[n - 1].tickValue - t[0].tickValue, u = (t[n - 1].coord - t[0].coord) / l;
    T(t, function(v) {
      v.coord -= u / 2;
    });
    var f = r.scale.getExtent();
    s = 1 + f[1] - t[n - 1].tickValue, o = {
      coord: t[n - 1].coord + u * s,
      tickValue: f[1] + 1
    }, t.push(o);
  }
  var h = a[0] > a[1];
  c(t[0].coord, a[0]) && (i ? t[0].coord = a[0] : t.shift()), i && c(a[0], t[0].coord) && t.unshift({
    coord: a[0]
  }), c(a[1], o.coord) && (i ? o.coord = a[1] : t.pop()), i && c(o.coord, a[1]) && t.push({
    coord: a[1]
  });
  function c(v, p) {
    return v = St(v), p = St(p), h ? v > p : v < p;
  }
}
function kD(r) {
  var t = rt.extend(r);
  return rt.registerClass(t), t;
}
function ND(r) {
  var t = kt.extend(r);
  return kt.registerClass(t), t;
}
function BD(r) {
  var t = Ut.extend(r);
  return Ut.registerClass(t), t;
}
function zD(r) {
  var t = Et.extend(r);
  return Et.registerClass(t), t;
}
function FD(r) {
  for (var t = [], e = 0; e < r.length; e++) {
    var i = r[e];
    if (!i.defaultAttr.ignore) {
      var n = i.label, a = n.getComputedTransform(), o = n.getBoundingRect(), s = !a || a[1] < 1e-5 && a[2] < 1e-5, l = n.style.margin || 0, u = o.clone();
      u.applyTransform(a), u.x -= l / 2, u.y -= l / 2, u.width += l, u.height += l;
      var f = s ? new es(o, a) : null;
      t.push({
        label: n,
        labelLine: i.labelLine,
        rect: u,
        localRect: o,
        obb: f,
        priority: i.priority,
        defaultAttr: i.defaultAttr,
        layoutOption: i.computedLayoutOption,
        axisAligned: s,
        transform: a
      });
    }
  }
  return t;
}
function VD(r) {
  var t = [];
  r.sort(function(g, d) {
    return d.priority - g.priority;
  });
  var e = new it(0, 0, 0, 0);
  function i(g) {
    if (!g.ignore) {
      var d = g.ensureState("emphasis");
      d.ignore == null && (d.ignore = !1);
    }
    g.ignore = !0;
  }
  for (var n = 0; n < r.length; n++) {
    var a = r[n], o = a.axisAligned, s = a.localRect, l = a.transform, u = a.label, f = a.labelLine;
    e.copy(a.rect), e.width -= 0.1, e.height -= 0.1, e.x += 0.05, e.y += 0.05;
    for (var h = a.obb, c = !1, v = 0; v < t.length; v++) {
      var p = t[v];
      if (e.intersect(p.rect)) {
        if (o && p.axisAligned) {
          c = !0;
          break;
        }
        if (p.obb || (p.obb = new es(p.localRect, p.transform)), h || (h = new es(s, l)), h.intersect(p.obb)) {
          c = !0;
          break;
        }
      }
    }
    c ? (i(u), f && i(f)) : (u.attr("ignore", a.defaultAttr.ignore), f && f.attr("ignore", a.defaultAttr.labelGuideIgnore), t.push(a));
  }
}
const _2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Axis: G0,
  ChartView: Et,
  ComponentModel: rt,
  ComponentView: kt,
  List: Kn,
  Model: pt,
  PRIORITY: Qm,
  SeriesModel: Ut,
  color: Y1,
  connect: tM,
  dataTool: sM,
  dependencies: BC,
  disConnect: eM,
  disconnect: o0,
  dispose: rM,
  env: Y,
  extendChartView: zD,
  extendComponentModel: kD,
  extendComponentView: ND,
  extendSeriesModel: BD,
  format: TD,
  getCoordinateSystemDimensions: nM,
  getInstanceByDom: Ea,
  getInstanceById: iM,
  getMap: oM,
  graphic: xD,
  helper: pD,
  init: a0,
  innerDrawElementOnCanvas: Gh,
  matrix: b1,
  number: bD,
  parseGeoJSON: $p,
  parseGeoJson: $p,
  registerAction: _i,
  registerCoordinateSystem: u0,
  registerLayout: f0,
  registerLoading: Kh,
  registerLocale: Ch,
  registerMap: h0,
  registerPostInit: s0,
  registerPostUpdate: l0,
  registerPreprocessor: $h,
  registerProcessor: Zh,
  registerTheme: Xh,
  registerTransform: v0,
  registerUpdateLifecycle: Js,
  registerVisual: Lr,
  setCanvasCreator: aM,
  setPlatformAPI: _g,
  throttle: qs,
  time: wD,
  use: ye,
  util: CD,
  vector: a1,
  version: NC,
  zrUtil: Z_,
  zrender: xS
}, Symbol.toStringTag, { value: "Module" }));
var HD = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e.hasSymbolVisual = !0, e;
    }
    return t.prototype.getInitialData = function(e) {
      return sn(null, this, {
        useEncodeDefaulter: !0
      });
    }, t.prototype.getLegendIcon = function(e) {
      var i = new gt(), n = ge("line", 0, e.itemHeight / 2, e.itemWidth, 0, e.lineStyle.stroke, !1);
      i.add(n), n.setStyle(e.lineStyle);
      var a = this.getData().getVisual("symbol"), o = this.getData().getVisual("symbolRotate"), s = a === "none" ? "circle" : a, l = e.itemHeight * 0.8, u = ge(s, (e.itemWidth - l) / 2, (e.itemHeight - l) / 2, l, l, e.itemStyle.fill);
      i.add(u), u.setStyle(e.itemStyle);
      var f = e.iconRotate === "inherit" ? o : e.iconRotate || 0;
      return u.rotation = f * Math.PI / 180, u.setOrigin([e.itemWidth / 2, e.itemHeight / 2]), s.indexOf("empty") > -1 && (u.style.stroke = u.style.fill, u.style.fill = "#fff", u.style.lineWidth = 2), i;
    }, t.type = "series.line", t.dependencies = ["grid", "polar"], t.defaultOption = {
      // zlevel: 0,
      z: 3,
      coordinateSystem: "cartesian2d",
      legendHoverLink: !0,
      clip: !0,
      label: {
        position: "top"
      },
      // itemStyle: {
      // },
      endLabel: {
        show: !1,
        valueAnimation: !0,
        distance: 8
      },
      lineStyle: {
        width: 2,
        type: "solid"
      },
      emphasis: {
        scale: !0
      },
      // areaStyle: {
      // origin of areaStyle. Valid values:
      // `'auto'/null/undefined`: from axisLine to data
      // `'start'`: from min to data
      // `'end'`: from data to max
      // origin: 'auto'
      // },
      // false, 'start', 'end', 'middle'
      step: !1,
      // Disabled if step is true
      smooth: !1,
      smoothMonotone: null,
      symbol: "emptyCircle",
      symbolSize: 4,
      symbolRotate: null,
      showSymbol: !0,
      // `false`: follow the label interval strategy.
      // `true`: show all symbols.
      // `'auto'`: If possible, show all symbols, otherwise
      //           follow the label interval strategy.
      showAllSymbol: "auto",
      // Whether to connect break point.
      connectNulls: !1,
      // Sampling for large data. Can be: 'average', 'max', 'min', 'sum', 'lttb'.
      sampling: "none",
      animationEasing: "linear",
      // Disable progressive
      progressive: 0,
      hoverLayerThreshold: 1 / 0,
      universalTransition: {
        divideShape: "clone"
      },
      triggerLineEvent: !1
    }, t;
  })(Ut)
);
function iv(r, t) {
  var e = r.mapDimensionsAll("defaultedLabel"), i = e.length;
  if (i === 1) {
    var n = tn(r, t, e[0]);
    return n != null ? n + "" : null;
  } else if (i) {
    for (var a = [], o = 0; o < e.length; o++)
      a.push(tn(r, t, e[o]));
    return a.join(" ");
  }
}
function W0(r, t) {
  var e = r.mapDimensionsAll("defaultedLabel");
  if (!O(t))
    return t + "";
  for (var i = [], n = 0; n < e.length; n++) {
    var a = r.getDimensionIndex(e[n]);
    a >= 0 && i.push(t[a]);
  }
  return i.join(" ");
}
var nv = (
  /** @class */
  (function(r) {
    F(t, r);
    function t(e, i, n, a) {
      var o = r.call(this) || this;
      return o.updateData(e, i, n, a), o;
    }
    return t.prototype._createSymbol = function(e, i, n, a, o) {
      this.removeAll();
      var s = ge(e, -1, -1, 2, 2, null, o);
      s.attr({
        z2: 100,
        culling: !0,
        scaleX: a[0] / 2,
        scaleY: a[1] / 2
      }), s.drift = GD, this._symbolType = e, this.add(s);
    }, t.prototype.stopSymbolAnimation = function(e) {
      this.childAt(0).stopAnimation(null, e);
    }, t.prototype.getSymbolType = function() {
      return this._symbolType;
    }, t.prototype.getSymbolPath = function() {
      return this.childAt(0);
    }, t.prototype.highlight = function() {
      sa(this.childAt(0));
    }, t.prototype.downplay = function() {
      la(this.childAt(0));
    }, t.prototype.setZ = function(e, i) {
      var n = this.childAt(0);
      n.zlevel = e, n.z = i;
    }, t.prototype.setDraggable = function(e, i) {
      var n = this.childAt(0);
      n.draggable = e, n.cursor = !i && e ? "move" : n.cursor;
    }, t.prototype.updateData = function(e, i, n, a) {
      this.silent = !1;
      var o = e.getItemVisual(i, "symbol") || "circle", s = e.hostModel, l = t.getSymbolSize(e, i), u = o !== this._symbolType, f = a && a.disableAnimation;
      if (u) {
        var h = e.getItemVisual(i, "symbolKeepAspect");
        this._createSymbol(o, e, i, l, h);
      } else {
        var c = this.childAt(0);
        c.silent = !1;
        var v = {
          scaleX: l[0] / 2,
          scaleY: l[1] / 2
        };
        f ? c.attr(v) : Wt(c, v, s, i), Ny(c);
      }
      if (this._updateCommon(e, i, l, n, a), u) {
        var c = this.childAt(0);
        if (!f) {
          var v = {
            scaleX: this._sizeX,
            scaleY: this._sizeY,
            style: {
              // Always fadeIn. Because it has fadeOut animation when symbol is removed..
              opacity: c.style.opacity
            }
          };
          c.scaleX = c.scaleY = 0, c.style.opacity = 0, Oe(c, v, s, i);
        }
      }
      f && this.childAt(0).stopAnimation("leave");
    }, t.prototype._updateCommon = function(e, i, n, a, o) {
      var s = this.childAt(0), l = e.hostModel, u, f, h, c, v, p, g, d, y;
      if (a && (u = a.emphasisItemStyle, f = a.blurItemStyle, h = a.selectItemStyle, c = a.focus, v = a.blurScope, g = a.labelStatesModels, d = a.hoverScale, y = a.cursorStyle, p = a.emphasisDisabled), !a || e.hasItemOption) {
        var m = a && a.itemModel ? a.itemModel : e.getItemModel(i), _ = m.getModel("emphasis");
        u = _.getModel("itemStyle").getItemStyle(), h = m.getModel(["select", "itemStyle"]).getItemStyle(), f = m.getModel(["blur", "itemStyle"]).getItemStyle(), c = _.get("focus"), v = _.get("blurScope"), p = _.get("disabled"), g = Dr(m), d = _.getShallow("scale"), y = m.getShallow("cursor");
      }
      var S = e.getItemVisual(i, "symbolRotate");
      s.attr("rotation", (S || 0) * Math.PI / 180 || 0);
      var w = Ks(e.getItemVisual(i, "symbolOffset"), n);
      w && (s.x = w[0], s.y = w[1]), y && s.attr("cursor", y);
      var b = e.getItemVisual(i, "style"), x = b.fill;
      if (s instanceof ke) {
        var M = s.style;
        s.useStyle(k({
          // TODO other properties like x, y ?
          image: M.image,
          x: M.x,
          y: M.y,
          width: M.width,
          height: M.height
        }, b));
      } else
        s.__isEmptyBrush ? s.useStyle(k({}, b)) : s.useStyle(b), s.style.decal = null, s.setColor(x, o && o.symbolInnerColor), s.style.strokeNoScale = !0;
      var D = e.getItemVisual(i, "liftZ"), A = this._z2;
      D != null ? A == null && (this._z2 = s.z2, s.z2 += D) : A != null && (s.z2 = A, this._z2 = null);
      var C = o && o.useNameLabel;
      nn(s, g, {
        labelFetcher: l,
        labelDataIndex: i,
        defaultText: I,
        inheritColor: x,
        defaultOpacity: b.opacity
      });
      function I(R) {
        return C ? e.getName(R) : iv(e, R);
      }
      this._sizeX = n[0] / 2, this._sizeY = n[1] / 2;
      var L = s.ensureState("emphasis");
      L.style = u, s.ensureState("select").style = h, s.ensureState("blur").style = f;
      var P = d == null || d === !0 ? Math.max(1.1, 3 / this._sizeY) : isFinite(d) && d > 0 ? +d : 1;
      L.scaleX = this._sizeX * P, L.scaleY = this._sizeY * P, this.setSymbolScale(1), Ji(this, c, v, p);
    }, t.prototype.setSymbolScale = function(e) {
      this.scaleX = this.scaleY = e;
    }, t.prototype.fadeOut = function(e, i, n) {
      var a = this.childAt(0), o = J(this).dataIndex, s = n && n.animation;
      if (this.silent = a.silent = !0, n && n.fadeLabel) {
        var l = a.getTextContent();
        l && rs(l, {
          style: {
            opacity: 0
          }
        }, i, {
          dataIndex: o,
          removeOpt: s,
          cb: function() {
            a.removeTextContent();
          }
        });
      } else
        a.removeTextContent();
      rs(a, {
        style: {
          opacity: 0
        },
        scaleX: 0,
        scaleY: 0
      }, i, {
        dataIndex: o,
        cb: e,
        removeOpt: s
      });
    }, t.getSymbolSize = function(e, i) {
      return Hh(e.getItemVisual(i, "symbolSize"));
    }, t;
  })(gt)
);
function GD(r, t) {
  this.parent.drift(r, t);
}
function uu(r, t, e, i) {
  return t && !isNaN(t[0]) && !isNaN(t[1]) && !(i.isIgnore && i.isIgnore(e)) && !(i.clipShape && !i.clipShape.contain(t[0], t[1])) && r.getItemVisual(e, "symbol") !== "none";
}
function Kp(r) {
  return r != null && !H(r) && (r = {
    isIgnore: r
  }), r || {};
}
function Qp(r) {
  var t = r.hostModel, e = t.getModel("emphasis");
  return {
    emphasisItemStyle: e.getModel("itemStyle").getItemStyle(),
    blurItemStyle: t.getModel(["blur", "itemStyle"]).getItemStyle(),
    selectItemStyle: t.getModel(["select", "itemStyle"]).getItemStyle(),
    focus: e.get("focus"),
    blurScope: e.get("blurScope"),
    emphasisDisabled: e.get("disabled"),
    hoverScale: e.get("scale"),
    labelStatesModels: Dr(t),
    cursorStyle: t.get("cursor")
  };
}
var U0 = (
  /** @class */
  (function() {
    function r(t) {
      this.group = new gt(), this._SymbolCtor = t || nv;
    }
    return r.prototype.updateData = function(t, e) {
      this._progressiveEls = null, e = Kp(e);
      var i = this.group, n = t.hostModel, a = this._data, o = this._SymbolCtor, s = e.disableAnimation, l = Qp(t), u = {
        disableAnimation: s
      }, f = e.getSymbolPoint || function(h) {
        return t.getItemLayout(h);
      };
      a || i.removeAll(), t.diff(a).add(function(h) {
        var c = f(h);
        if (uu(t, c, h, e)) {
          var v = new o(t, h, l, u);
          v.setPosition(c), t.setItemGraphicEl(h, v), i.add(v);
        }
      }).update(function(h, c) {
        var v = a.getItemGraphicEl(c), p = f(h);
        if (!uu(t, p, h, e)) {
          i.remove(v);
          return;
        }
        var g = t.getItemVisual(h, "symbol") || "circle", d = v && v.getSymbolType && v.getSymbolType();
        if (!v || d && d !== g)
          i.remove(v), v = new o(t, h, l, u), v.setPosition(p);
        else {
          v.updateData(t, h, l, u);
          var y = {
            x: p[0],
            y: p[1]
          };
          s ? v.attr(y) : Wt(v, y, n);
        }
        i.add(v), t.setItemGraphicEl(h, v);
      }).remove(function(h) {
        var c = a.getItemGraphicEl(h);
        c && c.fadeOut(function() {
          i.remove(c);
        }, n);
      }).execute(), this._getSymbolPoint = f, this._data = t;
    }, r.prototype.updateLayout = function() {
      var t = this, e = this._data;
      e && e.eachItemGraphicEl(function(i, n) {
        var a = t._getSymbolPoint(n);
        i.setPosition(a), i.markRedraw();
      });
    }, r.prototype.incrementalPrepareUpdate = function(t) {
      this._seriesScope = Qp(t), this._data = null, this.group.removeAll();
    }, r.prototype.incrementalUpdate = function(t, e, i) {
      this._progressiveEls = [], i = Kp(i);
      function n(l) {
        l.isGroup || (l.incremental = !0, l.ensureState("emphasis").hoverLayer = !0);
      }
      for (var a = t.start; a < t.end; a++) {
        var o = e.getItemLayout(a);
        if (uu(e, o, a, i)) {
          var s = new this._SymbolCtor(e, a, this._seriesScope);
          s.traverse(n), s.setPosition(o), this.group.add(s), e.setItemGraphicEl(a, s), this._progressiveEls.push(s);
        }
      }
    }, r.prototype.eachRendered = function(t) {
      rn(this._progressiveEls || this.group, t);
    }, r.prototype.remove = function(t) {
      var e = this.group, i = this._data;
      i && t ? i.eachItemGraphicEl(function(n) {
        n.fadeOut(function() {
          e.remove(n);
        }, i.hostModel);
      }) : e.removeAll();
    }, r;
  })()
);
function Y0(r, t, e) {
  var i = r.getBaseAxis(), n = r.getOtherAxis(i), a = WD(n, e), o = i.dim, s = n.dim, l = t.mapDimension(s), u = t.mapDimension(o), f = s === "x" || s === "radius" ? 1 : 0, h = z(r.dimensions, function(p) {
    return t.mapDimension(p);
  }), c = !1, v = t.getCalculationInfo("stackResultDimension");
  return Ir(
    t,
    h[0]
    /* , dims[1] */
  ) && (c = !0, h[0] = v), Ir(
    t,
    h[1]
    /* , dims[0] */
  ) && (c = !0, h[1] = v), {
    dataDimsForPoint: h,
    valueStart: a,
    valueAxisDim: s,
    baseAxisDim: o,
    stacked: !!c,
    valueDim: l,
    baseDim: u,
    baseDataOffset: f,
    stackedOverDimension: t.getCalculationInfo("stackedOverDimension")
  };
}
function WD(r, t) {
  var e = 0, i = r.scale.getExtent();
  return t === "start" ? e = i[0] : t === "end" ? e = i[1] : vt(t) && !isNaN(t) ? e = t : i[0] > 0 ? e = i[0] : i[1] < 0 && (e = i[1]), e;
}
function X0(r, t, e, i) {
  var n = NaN;
  r.stacked && (n = e.get(e.getCalculationInfo("stackedOverDimension"), i)), isNaN(n) && (n = r.valueStart);
  var a = r.baseDataOffset, o = [];
  return o[a] = e.get(r.baseDim, i), o[1 - a] = n, t.dataToPoint(o);
}
function UD(r, t) {
  var e = [];
  return t.diff(r).add(function(i) {
    e.push({
      cmd: "+",
      idx: i
    });
  }).update(function(i, n) {
    e.push({
      cmd: "=",
      idx: n,
      idx1: i
    });
  }).remove(function(i) {
    e.push({
      cmd: "-",
      idx: i
    });
  }).execute(), e;
}
function YD(r, t, e, i, n, a, o, s) {
  for (var l = UD(r, t), u = [], f = [], h = [], c = [], v = [], p = [], g = [], d = Y0(n, t, o), y = r.getLayout("points") || [], m = t.getLayout("points") || [], _ = 0; _ < l.length; _++) {
    var S = l[_], w = !0, b = void 0, x = void 0;
    switch (S.cmd) {
      case "=":
        b = S.idx * 2, x = S.idx1 * 2;
        var M = y[b], D = y[b + 1], A = m[x], C = m[x + 1];
        (isNaN(M) || isNaN(D)) && (M = A, D = C), u.push(M, D), f.push(A, C), h.push(e[b], e[b + 1]), c.push(i[x], i[x + 1]), g.push(t.getRawIndex(S.idx1));
        break;
      case "+":
        var I = S.idx, L = d.dataDimsForPoint, P = n.dataToPoint([t.get(L[0], I), t.get(L[1], I)]);
        x = I * 2, u.push(P[0], P[1]), f.push(m[x], m[x + 1]);
        var R = X0(d, n, t, I);
        h.push(R[0], R[1]), c.push(i[x], i[x + 1]), g.push(t.getRawIndex(I));
        break;
      case "-":
        w = !1;
    }
    w && (v.push(S), p.push(p.length));
  }
  p.sort(function(_t, Se) {
    return g[_t] - g[Se];
  });
  for (var E = u.length, G = tr(E), N = tr(E), B = tr(E), W = tr(E), K = [], _ = 0; _ < p.length; _++) {
    var tt = p[_], lt = _ * 2, yt = tt * 2;
    G[lt] = u[yt], G[lt + 1] = u[yt + 1], N[lt] = f[yt], N[lt + 1] = f[yt + 1], B[lt] = h[yt], B[lt + 1] = h[yt + 1], W[lt] = c[yt], W[lt + 1] = c[yt + 1], K[_] = v[tt];
  }
  return {
    current: G,
    next: N,
    stackedOnCurrent: B,
    stackedOnNext: W,
    status: K
  };
}
var fr = Math.min, hr = Math.max;
function hi(r, t) {
  return isNaN(r) || isNaN(t);
}
function Lf(r, t, e, i, n, a, o, s, l) {
  for (var u, f, h, c, v, p, g = e, d = 0; d < i; d++) {
    var y = t[g * 2], m = t[g * 2 + 1];
    if (g >= n || g < 0)
      break;
    if (hi(y, m)) {
      if (l) {
        g += a;
        continue;
      }
      break;
    }
    if (g === e)
      r[a > 0 ? "moveTo" : "lineTo"](y, m), h = y, c = m;
    else {
      var _ = y - u, S = m - f;
      if (_ * _ + S * S < 0.5) {
        g += a;
        continue;
      }
      if (o > 0) {
        for (var w = g + a, b = t[w * 2], x = t[w * 2 + 1]; b === y && x === m && d < i; )
          d++, w += a, g += a, b = t[w * 2], x = t[w * 2 + 1], y = t[g * 2], m = t[g * 2 + 1], _ = y - u, S = m - f;
        var M = d + 1;
        if (l)
          for (; hi(b, x) && M < i; )
            M++, w += a, b = t[w * 2], x = t[w * 2 + 1];
        var D = 0.5, A = 0, C = 0, I = void 0, L = void 0;
        if (M >= i || hi(b, x))
          v = y, p = m;
        else {
          A = b - u, C = x - f;
          var P = y - u, R = b - y, E = m - f, G = x - m, N = void 0, B = void 0;
          if (s === "x") {
            N = Math.abs(P), B = Math.abs(R);
            var W = A > 0 ? 1 : -1;
            v = y - W * N * o, p = m, I = y + W * B * o, L = m;
          } else if (s === "y") {
            N = Math.abs(E), B = Math.abs(G);
            var K = C > 0 ? 1 : -1;
            v = y, p = m - K * N * o, I = y, L = m + K * B * o;
          } else
            N = Math.sqrt(P * P + E * E), B = Math.sqrt(R * R + G * G), D = B / (B + N), v = y - A * o * (1 - D), p = m - C * o * (1 - D), I = y + A * o * D, L = m + C * o * D, I = fr(I, hr(b, y)), L = fr(L, hr(x, m)), I = hr(I, fr(b, y)), L = hr(L, fr(x, m)), A = I - y, C = L - m, v = y - A * N / B, p = m - C * N / B, v = fr(v, hr(u, y)), p = fr(p, hr(f, m)), v = hr(v, fr(u, y)), p = hr(p, fr(f, m)), A = y - v, C = m - p, I = y + A * B / N, L = m + C * B / N;
        }
        r.bezierCurveTo(h, c, v, p, y, m), h = I, c = L;
      } else
        r.lineTo(y, m);
    }
    u = y, f = m, g += a;
  }
  return d;
}
var $0 = (
  /** @class */
  /* @__PURE__ */ (function() {
    function r() {
      this.smooth = 0, this.smoothConstraint = !0;
    }
    return r;
  })()
), XD = (
  /** @class */
  (function(r) {
    F(t, r);
    function t(e) {
      var i = r.call(this, e) || this;
      return i.type = "ec-polyline", i;
    }
    return t.prototype.getDefaultStyle = function() {
      return {
        stroke: "#000",
        fill: null
      };
    }, t.prototype.getDefaultShape = function() {
      return new $0();
    }, t.prototype.buildPath = function(e, i) {
      var n = i.points, a = 0, o = n.length / 2;
      if (i.connectNulls) {
        for (; o > 0 && hi(n[o * 2 - 2], n[o * 2 - 1]); o--)
          ;
        for (; a < o && hi(n[a * 2], n[a * 2 + 1]); a++)
          ;
      }
      for (; a < o; )
        a += Lf(e, n, a, o, o, 1, i.smooth, i.smoothMonotone, i.connectNulls) + 1;
    }, t.prototype.getPointOn = function(e, i) {
      this.path || (this.createPathProxy(), this.buildPath(this.path, this.shape));
      for (var n = this.path, a = n.data, o = pi.CMD, s, l, u = i === "x", f = [], h = 0; h < a.length; ) {
        var c = a[h++], v = void 0, p = void 0, g = void 0, d = void 0, y = void 0, m = void 0, _ = void 0;
        switch (c) {
          case o.M:
            s = a[h++], l = a[h++];
            break;
          case o.L:
            if (v = a[h++], p = a[h++], _ = u ? (e - s) / (v - s) : (e - l) / (p - l), _ <= 1 && _ >= 0) {
              var S = u ? (p - l) * _ + l : (v - s) * _ + s;
              return u ? [e, S] : [S, e];
            }
            s = v, l = p;
            break;
          case o.C:
            v = a[h++], p = a[h++], g = a[h++], d = a[h++], y = a[h++], m = a[h++];
            var w = u ? Zo(s, v, g, y, e, f) : Zo(l, p, d, m, e, f);
            if (w > 0)
              for (var b = 0; b < w; b++) {
                var x = f[b];
                if (x <= 1 && x >= 0) {
                  var S = u ? Ct(l, p, d, m, x) : Ct(s, v, g, y, x);
                  return u ? [e, S] : [S, e];
                }
              }
            s = y, l = m;
            break;
        }
      }
    }, t;
  })(ot)
), $D = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      return r !== null && r.apply(this, arguments) || this;
    }
    return t;
  })($0)
), ZD = (
  /** @class */
  (function(r) {
    F(t, r);
    function t(e) {
      var i = r.call(this, e) || this;
      return i.type = "ec-polygon", i;
    }
    return t.prototype.getDefaultShape = function() {
      return new $D();
    }, t.prototype.buildPath = function(e, i) {
      var n = i.points, a = i.stackedOnPoints, o = 0, s = n.length / 2, l = i.smoothMonotone;
      if (i.connectNulls) {
        for (; s > 0 && hi(n[s * 2 - 2], n[s * 2 - 1]); s--)
          ;
        for (; o < s && hi(n[o * 2], n[o * 2 + 1]); o++)
          ;
      }
      for (; o < s; ) {
        var u = Lf(e, n, o, s, s, 1, i.smooth, l, i.connectNulls);
        Lf(e, a, o + u - 1, u, s, -1, i.stackedOnSmooth, l, i.connectNulls), o += u + 1, e.closePath();
      }
    }, t;
  })(ot)
);
function Z0(r, t, e, i, n) {
  var a = r.getArea(), o = a.x, s = a.y, l = a.width, u = a.height, f = e.get(["lineStyle", "width"]) || 0;
  o -= f / 2, s -= f / 2, l += f, u += f, l = Math.ceil(l), o !== Math.floor(o) && (o = Math.floor(o), l++);
  var h = new dt({
    shape: {
      x: o,
      y: s,
      width: l,
      height: u
    }
  });
  if (t) {
    var c = r.getBaseAxis(), v = c.isHorizontal(), p = c.inverse;
    v ? (p && (h.shape.x += l), h.shape.width = 0) : (p || (h.shape.y += u), h.shape.height = 0);
    var g = X(n) ? function(d) {
      n(d, h);
    } : null;
    Oe(h, {
      shape: {
        width: l,
        height: u,
        x: o,
        y: s
      }
    }, e, null, i, g);
  }
  return h;
}
function q0(r, t, e) {
  var i = r.getArea(), n = St(i.r0, 1), a = St(i.r, 1), o = new mi({
    shape: {
      cx: St(r.cx, 1),
      cy: St(r.cy, 1),
      r0: n,
      r: a,
      startAngle: i.startAngle,
      endAngle: i.endAngle,
      clockwise: i.clockwise
    }
  });
  if (t) {
    var s = r.getBaseAxis().dim === "angle";
    s ? o.shape.endAngle = i.startAngle : o.shape.r = n, Oe(o, {
      shape: {
        endAngle: i.endAngle,
        r: a
      }
    }, e);
  }
  return o;
}
function qD(r, t, e, i, n) {
  if (r) {
    if (r.type === "polar")
      return q0(r, t, e);
    if (r.type === "cartesian2d")
      return Z0(r, t, e, i, n);
  } else return null;
  return null;
}
function Oa(r, t) {
  return r.type === t;
}
function Jp(r, t) {
  if (r.length === t.length) {
    for (var e = 0; e < r.length; e++)
      if (r[e] !== t[e])
        return;
    return !0;
  }
}
function jp(r) {
  for (var t = 1 / 0, e = 1 / 0, i = -1 / 0, n = -1 / 0, a = 0; a < r.length; ) {
    var o = r[a++], s = r[a++];
    isNaN(o) || (t = Math.min(o, t), i = Math.max(o, i)), isNaN(s) || (e = Math.min(s, e), n = Math.max(s, n));
  }
  return [[t, e], [i, n]];
}
function td(r, t) {
  var e = jp(r), i = e[0], n = e[1], a = jp(t), o = a[0], s = a[1];
  return Math.max(Math.abs(i[0] - o[0]), Math.abs(i[1] - o[1]), Math.abs(n[0] - s[0]), Math.abs(n[1] - s[1]));
}
function ed(r) {
  return vt(r) ? r : r ? 0.5 : 0;
}
function KD(r, t, e) {
  if (!e.valueDim)
    return [];
  for (var i = t.count(), n = tr(i * 2), a = 0; a < i; a++) {
    var o = X0(e, r, t, a);
    n[a * 2] = o[0], n[a * 2 + 1] = o[1];
  }
  return n;
}
function vr(r, t, e, i, n) {
  var a = e.getBaseAxis(), o = a.dim === "x" || a.dim === "radius" ? 0 : 1, s = [], l = 0, u = [], f = [], h = [], c = [];
  if (n) {
    for (l = 0; l < r.length; l += 2) {
      var v = t || r;
      !isNaN(v[l]) && !isNaN(v[l + 1]) && c.push(r[l], r[l + 1]);
    }
    r = c;
  }
  for (l = 0; l < r.length - 2; l += 2)
    switch (h[0] = r[l + 2], h[1] = r[l + 3], f[0] = r[l], f[1] = r[l + 1], s.push(f[0], f[1]), i) {
      case "end":
        u[o] = h[o], u[1 - o] = f[1 - o], s.push(u[0], u[1]);
        break;
      case "middle":
        var p = (f[o] + h[o]) / 2, g = [];
        u[o] = g[o] = p, u[1 - o] = f[1 - o], g[1 - o] = h[1 - o], s.push(u[0], u[1]), s.push(g[0], g[1]);
        break;
      default:
        u[o] = f[o], u[1 - o] = h[1 - o], s.push(u[0], u[1]);
    }
  return s.push(r[l++], r[l++]), s;
}
function QD(r, t) {
  var e = [], i = r.length, n, a;
  function o(f, h, c) {
    var v = f.coord, p = (c - v) / (h.coord - v), g = ih(p, [f.color, h.color]);
    return {
      coord: c,
      color: g
    };
  }
  for (var s = 0; s < i; s++) {
    var l = r[s], u = l.coord;
    if (u < 0)
      n = l;
    else if (u > t) {
      a ? e.push(o(a, l, t)) : n && e.push(o(n, l, 0), o(n, l, t));
      break;
    } else
      n && (e.push(o(n, l, 0)), n = null), e.push(l), a = l;
  }
  return e;
}
function JD(r, t, e) {
  var i = r.getVisual("visualMeta");
  if (!(!i || !i.length || !r.count()) && t.type === "cartesian2d") {
    for (var n, a, o = i.length - 1; o >= 0; o--) {
      var s = r.getDimensionInfo(i[o].dimension);
      if (n = s && s.coordDim, n === "x" || n === "y") {
        a = i[o];
        break;
      }
    }
    if (a) {
      var l = t.getAxis(n), u = z(a.stops, function(_) {
        return {
          coord: l.toGlobalCoord(l.dataToCoord(_.value)),
          color: _.color
        };
      }), f = u.length, h = a.outerColors.slice();
      f && u[0].coord > u[f - 1].coord && (u.reverse(), h.reverse());
      var c = QD(u, n === "x" ? e.getWidth() : e.getHeight()), v = c.length;
      if (!v && f)
        return u[0].coord < 0 ? h[1] ? h[1] : u[f - 1].color : h[0] ? h[0] : u[0].color;
      var p = 10, g = c[0].coord - p, d = c[v - 1].coord + p, y = d - g;
      if (y < 1e-3)
        return "transparent";
      T(c, function(_) {
        _.offset = (_.coord - g) / y;
      }), c.push({
        // NOTE: inRangeStopLen may still be 0 if stoplen is zero.
        offset: v ? c[v - 1].offset : 0.5,
        color: h[1] || "transparent"
      }), c.unshift({
        offset: v ? c[0].offset : 0.5,
        color: h[0] || "transparent"
      });
      var m = new Os(0, 0, 0, 0, c, !0);
      return m[n] = g, m[n + "2"] = d, m;
    }
  }
}
function jD(r, t, e) {
  var i = r.get("showAllSymbol"), n = i === "auto";
  if (!(i && !n)) {
    var a = e.getAxesByScale("ordinal")[0];
    if (a && !(n && tA(a, t))) {
      var o = t.mapDimension(a.dim), s = {};
      return T(a.getViewLabels(), function(l) {
        var u = a.scale.getRawOrdinalNumber(l.tickValue);
        s[u] = 1;
      }), function(l) {
        return !s.hasOwnProperty(t.get(o, l));
      };
    }
  }
}
function tA(r, t) {
  var e = r.getExtent(), i = Math.abs(e[1] - e[0]) / r.scale.count();
  isNaN(i) && (i = 0);
  for (var n = t.count(), a = Math.max(1, Math.round(n / 5)), o = 0; o < n; o += a)
    if (nv.getSymbolSize(
      t,
      o
      // Only for cartesian, where `isHorizontal` exists.
    )[r.isHorizontal() ? 1 : 0] * 1.5 > i)
      return !1;
  return !0;
}
function eA(r, t) {
  return isNaN(r) || isNaN(t);
}
function rA(r) {
  for (var t = r.length / 2; t > 0 && eA(r[t * 2 - 2], r[t * 2 - 1]); t--)
    ;
  return t - 1;
}
function rd(r, t) {
  return [r[t * 2], r[t * 2 + 1]];
}
function iA(r, t, e) {
  for (var i = r.length / 2, n = e === "x" ? 0 : 1, a, o, s = 0, l = -1, u = 0; u < i; u++)
    if (o = r[u * 2 + n], !(isNaN(o) || isNaN(r[u * 2 + 1 - n]))) {
      if (u === 0) {
        a = o;
        continue;
      }
      if (a <= t && o >= t || a >= t && o <= t) {
        l = u;
        break;
      }
      s = u, a = o;
    }
  return {
    range: [s, l],
    t: (t - a) / (o - a)
  };
}
function K0(r) {
  if (r.get(["endLabel", "show"]))
    return !0;
  for (var t = 0; t < de.length; t++)
    if (r.get([de[t], "endLabel", "show"]))
      return !0;
  return !1;
}
function fu(r, t, e, i) {
  if (Oa(t, "cartesian2d")) {
    var n = i.getModel("endLabel"), a = n.get("valueAnimation"), o = i.getData(), s = {
      lastFrameIndex: 0
    }, l = K0(i) ? function(v, p) {
      r._endLabelOnDuring(v, p, o, s, a, n, t);
    } : null, u = t.getBaseAxis().isHorizontal(), f = Z0(t, e, i, function() {
      var v = r._endLabel;
      v && e && s.originalX != null && v.attr({
        x: s.originalX,
        y: s.originalY
      });
    }, l);
    if (!i.get("clip", !0)) {
      var h = f.shape, c = Math.max(h.width, h.height);
      u ? (h.y -= c, h.height += c * 2) : (h.x -= c, h.width += c * 2);
    }
    return l && l(1, f), f;
  } else
    return q0(t, e, i);
}
function nA(r, t) {
  var e = t.getBaseAxis(), i = e.isHorizontal(), n = e.inverse, a = i ? n ? "right" : "left" : "center", o = i ? "middle" : n ? "top" : "bottom";
  return {
    normal: {
      align: r.get("align") || a,
      verticalAlign: r.get("verticalAlign") || o
    }
  };
}
var aA = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      return r !== null && r.apply(this, arguments) || this;
    }
    return t.prototype.init = function() {
      var e = new gt(), i = new U0();
      this.group.add(i.group), this._symbolDraw = i, this._lineGroup = e, this._changePolyState = Q(this._changePolyState, this);
    }, t.prototype.render = function(e, i, n) {
      var a = e.coordinateSystem, o = this.group, s = e.getData(), l = e.getModel("lineStyle"), u = e.getModel("areaStyle"), f = s.getLayout("points") || [], h = a.type === "polar", c = this._coordSys, v = this._symbolDraw, p = this._polyline, g = this._polygon, d = this._lineGroup, y = !i.ssr && e.get("animation"), m = !u.isEmpty(), _ = u.get("origin"), S = Y0(a, s, _), w = m && KD(a, s, S), b = e.get("showSymbol"), x = e.get("connectNulls"), M = b && !h && jD(e, s, a), D = this._data;
      D && D.eachItemGraphicEl(function(_t, Se) {
        _t.__temp && (o.remove(_t), D.setItemGraphicEl(Se, null));
      }), b || v.remove(), o.add(d);
      var A = h ? !1 : e.get("step"), C;
      a && a.getArea && e.get("clip", !0) && (C = a.getArea(), C.width != null ? (C.x -= 0.1, C.y -= 0.1, C.width += 0.2, C.height += 0.2) : C.r0 && (C.r0 -= 0.5, C.r += 0.5)), this._clipShapeForSymbol = C;
      var I = JD(s, a, n) || s.getVisual("style")[s.getVisual("drawType")];
      if (!(p && c.type === a.type && A === this._step))
        b && v.updateData(s, {
          isIgnore: M,
          clipShape: C,
          disableAnimation: !0,
          getSymbolPoint: function(_t) {
            return [f[_t * 2], f[_t * 2 + 1]];
          }
        }), y && this._initSymbolLabelAnimation(s, a, C), A && (w && (w = vr(w, f, a, A, x)), f = vr(f, null, a, A, x)), p = this._newPolyline(f), m ? g = this._newPolygon(f, w) : g && (d.remove(g), g = this._polygon = null), h || this._initOrUpdateEndLabel(e, a, di(I)), d.setClipPath(fu(this, a, !0, e));
      else {
        m && !g ? g = this._newPolygon(f, w) : g && !m && (d.remove(g), g = this._polygon = null), h || this._initOrUpdateEndLabel(e, a, di(I));
        var L = d.getClipPath();
        if (L) {
          var P = fu(this, a, !1, e);
          Oe(L, {
            shape: P.shape
          }, e);
        } else
          d.setClipPath(fu(this, a, !0, e));
        b && v.updateData(s, {
          isIgnore: M,
          clipShape: C,
          disableAnimation: !0,
          getSymbolPoint: function(_t) {
            return [f[_t * 2], f[_t * 2 + 1]];
          }
        }), (!Jp(this._stackedOnPoints, w) || !Jp(this._points, f)) && (y ? this._doUpdateAnimation(s, w, a, n, A, _, x) : (A && (w && (w = vr(w, f, a, A, x)), f = vr(f, null, a, A, x)), p.setShape({
          points: f
        }), g && g.setShape({
          points: f,
          stackedOnPoints: w
        })));
      }
      var R = e.getModel("emphasis"), E = R.get("focus"), G = R.get("blurScope"), N = R.get("disabled");
      if (p.useStyle(at(
        // Use color in lineStyle first
        l.getLineStyle(),
        {
          fill: "none",
          stroke: I,
          lineJoin: "bevel"
        }
      )), of(p, e, "lineStyle"), p.style.lineWidth > 0 && e.get(["emphasis", "lineStyle", "width"]) === "bolder") {
        var B = p.getState("emphasis").style;
        B.lineWidth = +p.style.lineWidth + 1;
      }
      J(p).seriesIndex = e.seriesIndex, Ji(p, E, G, N);
      var W = ed(e.get("smooth")), K = e.get("smoothMonotone");
      if (p.setShape({
        smooth: W,
        smoothMonotone: K,
        connectNulls: x
      }), g) {
        var tt = s.getCalculationInfo("stackedOnSeries"), lt = 0;
        g.useStyle(at(u.getAreaStyle(), {
          fill: I,
          opacity: 0.7,
          lineJoin: "bevel",
          decal: s.getVisual("style").decal
        })), tt && (lt = ed(tt.get("smooth"))), g.setShape({
          smooth: W,
          stackedOnSmooth: lt,
          smoothMonotone: K,
          connectNulls: x
        }), of(g, e, "areaStyle"), J(g).seriesIndex = e.seriesIndex, Ji(g, E, G, N);
      }
      var yt = this._changePolyState;
      s.eachItemGraphicEl(function(_t) {
        _t && (_t.onHoverStateChange = yt);
      }), this._polyline.onHoverStateChange = yt, this._data = s, this._coordSys = a, this._stackedOnPoints = w, this._points = f, this._step = A, this._valueOrigin = _, e.get("triggerLineEvent") && (this.packEventData(e, p), g && this.packEventData(e, g));
    }, t.prototype.packEventData = function(e, i) {
      J(i).eventData = {
        componentType: "series",
        componentSubType: "line",
        componentIndex: e.componentIndex,
        seriesIndex: e.seriesIndex,
        seriesName: e.name,
        seriesType: "line"
      };
    }, t.prototype.highlight = function(e, i, n, a) {
      var o = e.getData(), s = ci(o, a);
      if (this._changePolyState("emphasis"), !(s instanceof Array) && s != null && s >= 0) {
        var l = o.getLayout("points"), u = o.getItemGraphicEl(s);
        if (!u) {
          var f = l[s * 2], h = l[s * 2 + 1];
          if (isNaN(f) || isNaN(h) || this._clipShapeForSymbol && !this._clipShapeForSymbol.contain(f, h))
            return;
          var c = e.get("zlevel") || 0, v = e.get("z") || 0;
          u = new nv(o, s), u.x = f, u.y = h, u.setZ(c, v);
          var p = u.getSymbolPath().getTextContent();
          p && (p.zlevel = c, p.z = v, p.z2 = this._polyline.z2 + 1), u.__temp = !0, o.setItemGraphicEl(s, u), u.stopSymbolAnimation(!0), this.group.add(u);
        }
        u.highlight();
      } else
        Et.prototype.highlight.call(this, e, i, n, a);
    }, t.prototype.downplay = function(e, i, n, a) {
      var o = e.getData(), s = ci(o, a);
      if (this._changePolyState("normal"), s != null && s >= 0) {
        var l = o.getItemGraphicEl(s);
        l && (l.__temp ? (o.setItemGraphicEl(s, null), this.group.remove(l)) : l.downplay());
      } else
        Et.prototype.downplay.call(this, e, i, n, a);
    }, t.prototype._changePolyState = function(e) {
      var i = this._polygon;
      lc(this._polyline, e), i && lc(i, e);
    }, t.prototype._newPolyline = function(e) {
      var i = this._polyline;
      return i && this._lineGroup.remove(i), i = new XD({
        shape: {
          points: e
        },
        segmentIgnoreThreshold: 2,
        z2: 10
      }), this._lineGroup.add(i), this._polyline = i, i;
    }, t.prototype._newPolygon = function(e, i) {
      var n = this._polygon;
      return n && this._lineGroup.remove(n), n = new ZD({
        shape: {
          points: e,
          stackedOnPoints: i
        },
        segmentIgnoreThreshold: 2
      }), this._lineGroup.add(n), this._polygon = n, n;
    }, t.prototype._initSymbolLabelAnimation = function(e, i, n) {
      var a, o, s = i.getBaseAxis(), l = s.inverse;
      i.type === "cartesian2d" ? (a = s.isHorizontal(), o = !1) : i.type === "polar" && (a = s.dim === "angle", o = !0);
      var u = e.hostModel, f = u.get("animationDuration");
      X(f) && (f = f(null));
      var h = u.get("animationDelay") || 0, c = X(h) ? h(null) : h;
      e.eachItemGraphicEl(function(v, p) {
        var g = v;
        if (g) {
          var d = [v.x, v.y], y = void 0, m = void 0, _ = void 0;
          if (n)
            if (o) {
              var S = n, w = i.pointToCoord(d);
              a ? (y = S.startAngle, m = S.endAngle, _ = -w[1] / 180 * Math.PI) : (y = S.r0, m = S.r, _ = w[0]);
            } else {
              var b = n;
              a ? (y = b.x, m = b.x + b.width, _ = v.x) : (y = b.y + b.height, m = b.y, _ = v.y);
            }
          var x = m === y ? 0 : (_ - y) / (m - y);
          l && (x = 1 - x);
          var M = X(h) ? h(p) : f * x + c, D = g.getSymbolPath(), A = D.getTextContent();
          g.attr({
            scaleX: 0,
            scaleY: 0
          }), g.animateTo({
            scaleX: 1,
            scaleY: 1
          }, {
            duration: 200,
            setToFinal: !0,
            delay: M
          }), A && A.animateFrom({
            style: {
              opacity: 0
            }
          }, {
            duration: 300,
            delay: M
          }), D.disableLabelAnimation = !0;
        }
      });
    }, t.prototype._initOrUpdateEndLabel = function(e, i, n) {
      var a = e.getModel("endLabel");
      if (K0(e)) {
        var o = e.getData(), s = this._polyline, l = o.getLayout("points");
        if (!l) {
          s.removeTextContent(), this._endLabel = null;
          return;
        }
        var u = this._endLabel;
        u || (u = this._endLabel = new mt({
          z2: 200
          // should be higher than item symbol
        }), u.ignoreClip = !0, s.setTextContent(this._endLabel), s.disableLabelAnimation = !0);
        var f = rA(l);
        f >= 0 && (nn(s, Dr(e, "endLabel"), {
          inheritColor: n,
          labelFetcher: e,
          labelDataIndex: f,
          defaultText: function(h, c, v) {
            return v != null ? W0(o, v) : iv(o, h);
          },
          enableTextSetter: !0
        }, nA(a, i)), s.textConfig.position = null);
      } else this._endLabel && (this._polyline.removeTextContent(), this._endLabel = null);
    }, t.prototype._endLabelOnDuring = function(e, i, n, a, o, s, l) {
      var u = this._endLabel, f = this._polyline;
      if (u) {
        e < 1 && a.originalX == null && (a.originalX = u.x, a.originalY = u.y);
        var h = n.getLayout("points"), c = n.hostModel, v = c.get("connectNulls"), p = s.get("precision"), g = s.get("distance") || 0, d = l.getBaseAxis(), y = d.isHorizontal(), m = d.inverse, _ = i.shape, S = m ? y ? _.x : _.y + _.height : y ? _.x + _.width : _.y, w = (y ? g : 0) * (m ? -1 : 1), b = (y ? 0 : -g) * (m ? -1 : 1), x = y ? "x" : "y", M = iA(h, S, x), D = M.range, A = D[1] - D[0], C = void 0;
        if (A >= 1) {
          if (A > 1 && !v) {
            var I = rd(h, D[0]);
            u.attr({
              x: I[0] + w,
              y: I[1] + b
            }), o && (C = c.getRawValue(D[0]));
          } else {
            var I = f.getPointOn(S, x);
            I && u.attr({
              x: I[0] + w,
              y: I[1] + b
            });
            var L = c.getRawValue(D[0]), P = c.getRawValue(D[1]);
            o && (C = XS(n, p, L, P, M.t));
          }
          a.lastFrameIndex = D[0];
        } else {
          var R = e === 1 || a.lastFrameIndex > 0 ? D[0] : 0, I = rd(h, R);
          o && (C = c.getRawValue(R)), u.attr({
            x: I[0] + w,
            y: I[1] + b
          });
        }
        if (o) {
          var E = Fs(u);
          typeof E.setLabelText == "function" && E.setLabelText(C);
        }
      }
    }, t.prototype._doUpdateAnimation = function(e, i, n, a, o, s, l) {
      var u = this._polyline, f = this._polygon, h = e.hostModel, c = YD(this._data, e, this._stackedOnPoints, i, this._coordSys, n, this._valueOrigin), v = c.current, p = c.stackedOnCurrent, g = c.next, d = c.stackedOnNext;
      if (o && (p = vr(c.stackedOnCurrent, c.current, n, o, l), v = vr(c.current, null, n, o, l), d = vr(c.stackedOnNext, c.next, n, o, l), g = vr(c.next, null, n, o, l)), td(v, g) > 3e3 || f && td(p, d) > 3e3) {
        u.stopAnimation(), u.setShape({
          points: g
        }), f && (f.stopAnimation(), f.setShape({
          points: g,
          stackedOnPoints: d
        }));
        return;
      }
      u.shape.__points = c.current, u.shape.points = v;
      var y = {
        shape: {
          points: g
        }
      };
      c.current !== v && (y.shape.__points = c.next), u.stopAnimation(), Wt(u, y, h), f && (f.setShape({
        // Reuse the points with polyline.
        points: v,
        stackedOnPoints: p
      }), f.stopAnimation(), Wt(f, {
        shape: {
          stackedOnPoints: d
        }
      }, h), u.shape.points !== f.shape.points && (f.shape.points = u.shape.points));
      for (var m = [], _ = c.status, S = 0; S < _.length; S++) {
        var w = _[S].cmd;
        if (w === "=") {
          var b = e.getItemGraphicEl(_[S].idx1);
          b && m.push({
            el: b,
            ptIdx: S
            // Index of points
          });
        }
      }
      u.animators && u.animators.length && u.animators[0].during(function() {
        f && f.dirtyShape();
        for (var x = u.shape.__points, M = 0; M < m.length; M++) {
          var D = m[M].el, A = m[M].ptIdx * 2;
          D.x = x[A], D.y = x[A + 1], D.markRedraw();
        }
      });
    }, t.prototype.remove = function(e) {
      var i = this.group, n = this._data;
      this._lineGroup.removeAll(), this._symbolDraw.remove(!0), n && n.eachItemGraphicEl(function(a, o) {
        a.__temp && (i.remove(a), n.setItemGraphicEl(o, null));
      }), this._polyline = this._polygon = this._coordSys = this._points = this._stackedOnPoints = this._endLabel = this._data = null;
    }, t.type = "line", t;
  })(Et)
);
function av(r, t) {
  return {
    seriesType: r,
    plan: Fh(),
    reset: function(e) {
      var i = e.getData(), n = e.coordinateSystem, a = e.pipelineContext, o = t || a.large;
      if (n) {
        var s = z(n.dimensions, function(v) {
          return i.mapDimension(v);
        }).slice(0, 2), l = s.length, u = i.getCalculationInfo("stackResultDimension");
        Ir(i, s[0]) && (s[0] = u), Ir(i, s[1]) && (s[1] = u);
        var f = i.getStore(), h = i.getDimensionIndex(s[0]), c = i.getDimensionIndex(s[1]);
        return l && {
          progress: function(v, p) {
            for (var g = v.end - v.start, d = o && tr(g * l), y = [], m = [], _ = v.start, S = 0; _ < v.end; _++) {
              var w = void 0;
              if (l === 1) {
                var b = f.get(h, _);
                w = n.dataToPoint(b, null, m);
              } else
                y[0] = f.get(h, _), y[1] = f.get(c, _), w = n.dataToPoint(y, null, m);
              o ? (d[S++] = w[0], d[S++] = w[1]) : p.setItemLayout(_, w.slice());
            }
            o && p.setLayout("points", d);
          }
        };
      }
    }
  };
}
var oA = {
  average: function(r) {
    for (var t = 0, e = 0, i = 0; i < r.length; i++)
      isNaN(r[i]) || (t += r[i], e++);
    return e === 0 ? NaN : t / e;
  },
  sum: function(r) {
    for (var t = 0, e = 0; e < r.length; e++)
      t += r[e] || 0;
    return t;
  },
  max: function(r) {
    for (var t = -1 / 0, e = 0; e < r.length; e++)
      r[e] > t && (t = r[e]);
    return isFinite(t) ? t : NaN;
  },
  min: function(r) {
    for (var t = 1 / 0, e = 0; e < r.length; e++)
      r[e] < t && (t = r[e]);
    return isFinite(t) ? t : NaN;
  },
  // TODO
  // Median
  nearest: function(r) {
    return r[0];
  }
}, sA = function(r) {
  return Math.round(r.length / 2);
};
function Q0(r) {
  return {
    seriesType: r,
    // FIXME:TS never used, so comment it
    // modifyOutputEnd: true,
    reset: function(t, e, i) {
      var n = t.getData(), a = t.get("sampling"), o = t.coordinateSystem, s = n.count();
      if (s > 10 && o.type === "cartesian2d" && a) {
        var l = o.getBaseAxis(), u = o.getOtherAxis(l), f = l.getExtent(), h = i.getDevicePixelRatio(), c = Math.abs(f[1] - f[0]) * (h || 1), v = Math.round(s / c);
        if (isFinite(v) && v > 1) {
          a === "lttb" ? t.setData(n.lttbDownSample(n.mapDimension(u.dim), 1 / v)) : a === "minmax" && t.setData(n.minmaxDownSample(n.mapDimension(u.dim), 1 / v));
          var p = void 0;
          V(a) ? p = oA[a] : X(a) && (p = a), p && t.setData(n.downSample(n.mapDimension(u.dim), 1 / v, p, sA));
        }
      }
    }
  };
}
function lA(r) {
  r.registerChartView(aA), r.registerSeriesModel(HD), r.registerLayout(av("line", !0)), r.registerVisual({
    seriesType: "line",
    reset: function(t) {
      var e = t.getData(), i = t.getModel("lineStyle").getLineStyle();
      i && !i.stroke && (i.stroke = e.getVisual("style").fill), e.setVisual("legendLineStyle", i);
    }
  }), r.registerProcessor(r.PRIORITY.PROCESSOR.STATISTIC, Q0("line"));
}
var Pf = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e;
    }
    return t.prototype.getInitialData = function(e, i) {
      return sn(null, this, {
        useEncodeDefaulter: !0
      });
    }, t.prototype.getMarkerPosition = function(e, i, n) {
      var a = this.coordinateSystem;
      if (a && a.clampData) {
        var o = a.clampData(e), s = a.dataToPoint(o);
        if (n)
          T(a.getAxes(), function(c, v) {
            if (c.type === "category" && i != null) {
              var p = c.getTicksCoords(), g = c.getTickModel().get("alignWithLabel"), d = o[v], y = i[v] === "x1" || i[v] === "y1";
              if (y && !g && (d += 1), p.length < 2)
                return;
              if (p.length === 2) {
                s[v] = c.toGlobalCoord(c.getExtent()[y ? 1 : 0]);
                return;
              }
              for (var m = void 0, _ = void 0, S = 1, w = 0; w < p.length; w++) {
                var b = p[w].coord, x = w === p.length - 1 ? p[w - 1].tickValue + S : p[w].tickValue;
                if (x === d) {
                  _ = b;
                  break;
                } else if (x < d)
                  m = b;
                else if (m != null && x > d) {
                  _ = (b + m) / 2;
                  break;
                }
                w === 1 && (S = x - p[0].tickValue);
              }
              _ == null && (m ? m && (_ = p[p.length - 1].coord) : _ = p[0].coord), s[v] = c.toGlobalCoord(_);
            }
          });
        else {
          var l = this.getData(), u = l.getLayout("offset"), f = l.getLayout("size"), h = a.getBaseAxis().isHorizontal() ? 0 : 1;
          s[h] += u + f / 2;
        }
        return s;
      }
      return [NaN, NaN];
    }, t.type = "series.__base_bar__", t.defaultOption = {
      // zlevel: 0,
      z: 2,
      coordinateSystem: "cartesian2d",
      legendHoverLink: !0,
      // stack: null
      // Cartesian coordinate system
      // xAxisIndex: 0,
      // yAxisIndex: 0,
      barMinHeight: 0,
      barMinAngle: 0,
      // cursor: null,
      large: !1,
      largeThreshold: 400,
      progressive: 3e3,
      progressiveChunkMode: "mod"
    }, t;
  })(Ut)
);
Ut.registerClass(Pf);
var uA = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e;
    }
    return t.prototype.getInitialData = function() {
      return sn(null, this, {
        useEncodeDefaulter: !0,
        createInvertedIndices: !!this.get("realtimeSort", !0) || null
      });
    }, t.prototype.getProgressive = function() {
      return this.get("large") ? this.get("progressive") : !1;
    }, t.prototype.getProgressiveThreshold = function() {
      var e = this.get("progressiveThreshold"), i = this.get("largeThreshold");
      return i > e && (e = i), e;
    }, t.prototype.brushSelector = function(e, i, n) {
      return n.rect(i.getItemLayout(e));
    }, t.type = "series.bar", t.dependencies = ["grid", "polar"], t.defaultOption = Hs(Pf.defaultOption, {
      // If clipped
      // Only available on cartesian2d
      clip: !0,
      roundCap: !1,
      showBackground: !1,
      backgroundStyle: {
        color: "rgba(180, 180, 180, 0.2)",
        borderColor: null,
        borderWidth: 0,
        borderType: "solid",
        borderRadius: 0,
        shadowBlur: 0,
        shadowColor: null,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        opacity: 1
      },
      select: {
        itemStyle: {
          borderColor: "#212121"
        }
      },
      realtimeSort: !1
    }), t;
  })(Pf)
), fA = (
  /** @class */
  /* @__PURE__ */ (function() {
    function r() {
      this.cx = 0, this.cy = 0, this.r0 = 0, this.r = 0, this.startAngle = 0, this.endAngle = Math.PI * 2, this.clockwise = !0;
    }
    return r;
  })()
), id = (
  /** @class */
  (function(r) {
    F(t, r);
    function t(e) {
      var i = r.call(this, e) || this;
      return i.type = "sausage", i;
    }
    return t.prototype.getDefaultShape = function() {
      return new fA();
    }, t.prototype.buildPath = function(e, i) {
      var n = i.cx, a = i.cy, o = Math.max(i.r0 || 0, 0), s = Math.max(i.r, 0), l = (s - o) * 0.5, u = o + l, f = i.startAngle, h = i.endAngle, c = i.clockwise, v = Math.PI * 2, p = c ? h - f < v : f - h < v;
      p || (f = h - (c ? v : -v));
      var g = Math.cos(f), d = Math.sin(f), y = Math.cos(h), m = Math.sin(h);
      p ? (e.moveTo(g * o + n, d * o + a), e.arc(g * u + n, d * u + a, l, -Math.PI + f, f, !c)) : e.moveTo(g * s + n, d * s + a), e.arc(n, a, s, f, h, !c), e.arc(y * u + n, m * u + a, l, h - Math.PI * 2, h - Math.PI, !c), o !== 0 && e.arc(n, a, o, h, f, c);
    }, t;
  })(ot)
);
function hA(r, t) {
  t = t || {};
  var e = t.isRoundCap;
  return function(i, n, a) {
    var o = n.position;
    if (!o || o instanceof Array)
      return Jo(i, n, a);
    var s = r(o), l = n.distance != null ? n.distance : 5, u = this.shape, f = u.cx, h = u.cy, c = u.r, v = u.r0, p = (c + v) / 2, g = u.startAngle, d = u.endAngle, y = (g + d) / 2, m = e ? Math.abs(c - v) / 2 : 0, _ = Math.cos, S = Math.sin, w = f + c * _(g), b = h + c * S(g), x = "left", M = "top";
    switch (s) {
      case "startArc":
        w = f + (v - l) * _(y), b = h + (v - l) * S(y), x = "center", M = "top";
        break;
      case "insideStartArc":
        w = f + (v + l) * _(y), b = h + (v + l) * S(y), x = "center", M = "bottom";
        break;
      case "startAngle":
        w = f + p * _(g) + go(g, l + m, !1), b = h + p * S(g) + yo(g, l + m, !1), x = "right", M = "middle";
        break;
      case "insideStartAngle":
        w = f + p * _(g) + go(g, -l + m, !1), b = h + p * S(g) + yo(g, -l + m, !1), x = "left", M = "middle";
        break;
      case "middle":
        w = f + p * _(y), b = h + p * S(y), x = "center", M = "middle";
        break;
      case "endArc":
        w = f + (c + l) * _(y), b = h + (c + l) * S(y), x = "center", M = "bottom";
        break;
      case "insideEndArc":
        w = f + (c - l) * _(y), b = h + (c - l) * S(y), x = "center", M = "top";
        break;
      case "endAngle":
        w = f + p * _(d) + go(d, l + m, !0), b = h + p * S(d) + yo(d, l + m, !0), x = "left", M = "middle";
        break;
      case "insideEndAngle":
        w = f + p * _(d) + go(d, -l + m, !0), b = h + p * S(d) + yo(d, -l + m, !0), x = "right", M = "middle";
        break;
      default:
        return Jo(i, n, a);
    }
    return i = i || {}, i.x = w, i.y = b, i.align = x, i.verticalAlign = M, i;
  };
}
function vA(r, t, e, i) {
  if (vt(i)) {
    r.setTextConfig({
      rotation: i
    });
    return;
  } else if (O(t)) {
    r.setTextConfig({
      rotation: 0
    });
    return;
  }
  var n = r.shape, a = n.clockwise ? n.startAngle : n.endAngle, o = n.clockwise ? n.endAngle : n.startAngle, s = (a + o) / 2, l, u = e(t);
  switch (u) {
    case "startArc":
    case "insideStartArc":
    case "middle":
    case "insideEndArc":
    case "endArc":
      l = s;
      break;
    case "startAngle":
    case "insideStartAngle":
      l = a;
      break;
    case "endAngle":
    case "insideEndAngle":
      l = o;
      break;
    default:
      r.setTextConfig({
        rotation: 0
      });
      return;
  }
  var f = Math.PI * 1.5 - l;
  u === "middle" && f > Math.PI / 2 && f < Math.PI * 1.5 && (f -= Math.PI), r.setTextConfig({
    rotation: f
  });
}
function go(r, t, e) {
  return t * Math.sin(r) * (e ? -1 : 1);
}
function yo(r, t, e) {
  return t * Math.cos(r) * (e ? 1 : -1);
}
function cA(r, t, e) {
  var i = r.get("borderRadius");
  if (i == null)
    return {
      cornerRadius: 0
    };
  O(i) || (i = [i, i, i, i]);
  var n = Math.abs(t.r || 0 - t.r0 || 0);
  return {
    cornerRadius: z(i, function(a) {
      return Ue(a, n);
    })
  };
}
var hu = Math.max, vu = Math.min;
function pA(r, t) {
  var e = r.getArea && r.getArea();
  if (Oa(r, "cartesian2d")) {
    var i = r.getBaseAxis();
    if (i.type !== "category" || !i.onBand) {
      var n = t.getLayout("bandWidth");
      i.isHorizontal() ? (e.x -= n, e.width += n * 2) : (e.y -= n, e.height += n * 2);
    }
  }
  return e;
}
var dA = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r.call(this) || this;
      return e.type = t.type, e._isFirstFrame = !0, e;
    }
    return t.prototype.render = function(e, i, n, a) {
      this._model = e, this._removeOnRenderedListener(n), this._updateDrawMode(e);
      var o = e.get("coordinateSystem");
      (o === "cartesian2d" || o === "polar") && (this._progressiveEls = null, this._isLargeDraw ? this._renderLarge(e, i, n) : this._renderNormal(e, i, n, a));
    }, t.prototype.incrementalPrepareRender = function(e) {
      this._clear(), this._updateDrawMode(e), this._updateLargeClip(e);
    }, t.prototype.incrementalRender = function(e, i) {
      this._progressiveEls = [], this._incrementalRenderLarge(e, i);
    }, t.prototype.eachRendered = function(e) {
      rn(this._progressiveEls || this.group, e);
    }, t.prototype._updateDrawMode = function(e) {
      var i = e.pipelineContext.large;
      (this._isLargeDraw == null || i !== this._isLargeDraw) && (this._isLargeDraw = i, this._clear());
    }, t.prototype._renderNormal = function(e, i, n, a) {
      var o = this.group, s = e.getData(), l = this._data, u = e.coordinateSystem, f = u.getBaseAxis(), h;
      u.type === "cartesian2d" ? h = f.isHorizontal() : u.type === "polar" && (h = f.dim === "angle");
      var c = e.isAnimationEnabled() ? e : null, v = gA(e, u);
      v && this._enableRealtimeSort(v, s, n);
      var p = e.get("clip", !0) || v, g = pA(u, s);
      o.removeClipPath();
      var d = e.get("roundCap", !0), y = e.get("showBackground", !0), m = e.getModel("backgroundStyle"), _ = m.get("borderRadius") || 0, S = [], w = this._backgroundEls, b = a && a.isInitSort, x = a && a.type === "changeAxisOrder";
      function M(C) {
        var I = mo[u.type](s, C), L = xA(u, h, I);
        return L.useStyle(m.getItemStyle()), u.type === "cartesian2d" ? L.setShape("r", _) : L.setShape("cornerRadius", _), S[C] = L, L;
      }
      s.diff(l).add(function(C) {
        var I = s.getItemModel(C), L = mo[u.type](s, C, I);
        if (y && M(C), !(!s.hasValue(C) || !ld[u.type](L))) {
          var P = !1;
          p && (P = nd[u.type](g, L));
          var R = ad[u.type](e, s, C, L, h, c, f.model, !1, d);
          v && (R.forceLabelAnimation = !0), ud(R, s, C, I, L, e, h, u.type === "polar"), b ? R.attr({
            shape: L
          }) : v ? od(v, c, R, L, C, h, !1, !1) : Oe(R, {
            shape: L
          }, e, C), s.setItemGraphicEl(C, R), o.add(R), R.ignore = P;
        }
      }).update(function(C, I) {
        var L = s.getItemModel(C), P = mo[u.type](s, C, L);
        if (y) {
          var R = void 0;
          w.length === 0 ? R = M(I) : (R = w[I], R.useStyle(m.getItemStyle()), u.type === "cartesian2d" ? R.setShape("r", _) : R.setShape("cornerRadius", _), S[C] = R);
          var E = mo[u.type](s, C), G = j0(h, E, u);
          Wt(R, {
            shape: G
          }, c, C);
        }
        var N = l.getItemGraphicEl(I);
        if (!s.hasValue(C) || !ld[u.type](P)) {
          o.remove(N);
          return;
        }
        var B = !1;
        if (p && (B = nd[u.type](g, P), B && o.remove(N)), N ? Ny(N) : N = ad[u.type](e, s, C, P, h, c, f.model, !!N, d), v && (N.forceLabelAnimation = !0), x) {
          var W = N.getTextContent();
          if (W) {
            var K = Fs(W);
            K.prevValue != null && (K.prevValue = K.value);
          }
        } else
          ud(N, s, C, L, P, e, h, u.type === "polar");
        b ? N.attr({
          shape: P
        }) : v ? od(v, c, N, P, C, h, !0, x) : Wt(N, {
          shape: P
        }, e, C, null), s.setItemGraphicEl(C, N), N.ignore = B, o.add(N);
      }).remove(function(C) {
        var I = l.getItemGraphicEl(C);
        I && ff(I, e, C);
      }).execute();
      var D = this._backgroundGroup || (this._backgroundGroup = new gt());
      D.removeAll();
      for (var A = 0; A < S.length; ++A)
        D.add(S[A]);
      o.add(D), this._backgroundEls = S, this._data = s;
    }, t.prototype._renderLarge = function(e, i, n) {
      this._clear(), hd(e, this.group), this._updateLargeClip(e);
    }, t.prototype._incrementalRenderLarge = function(e, i) {
      this._removeBackground(), hd(i, this.group, this._progressiveEls, !0);
    }, t.prototype._updateLargeClip = function(e) {
      var i = e.get("clip", !0) && qD(e.coordinateSystem, !1, e), n = this.group;
      i ? n.setClipPath(i) : n.removeClipPath();
    }, t.prototype._enableRealtimeSort = function(e, i, n) {
      var a = this;
      if (i.count()) {
        var o = e.baseAxis;
        if (this._isFirstFrame)
          this._dispatchInitSort(i, e, n), this._isFirstFrame = !1;
        else {
          var s = function(l) {
            var u = i.getItemGraphicEl(l), f = u && u.shape;
            return f && // The result should be consistent with the initial sort by data value.
            // Do not support the case that both positive and negative exist.
            Math.abs(o.isHorizontal() ? f.height : f.width) || 0;
          };
          this._onRendered = function() {
            a._updateSortWithinSameData(i, s, o, n);
          }, n.getZr().on("rendered", this._onRendered);
        }
      }
    }, t.prototype._dataSort = function(e, i, n) {
      var a = [];
      return e.each(e.mapDimension(i.dim), function(o, s) {
        var l = n(s);
        l = l ?? NaN, a.push({
          dataIndex: s,
          mappedValue: l,
          ordinalNumber: o
        });
      }), a.sort(function(o, s) {
        return s.mappedValue - o.mappedValue;
      }), {
        ordinalNumbers: z(a, function(o) {
          return o.ordinalNumber;
        })
      };
    }, t.prototype._isOrderChangedWithinSameData = function(e, i, n) {
      for (var a = n.scale, o = e.mapDimension(n.dim), s = Number.MAX_VALUE, l = 0, u = a.getOrdinalMeta().categories.length; l < u; ++l) {
        var f = e.rawIndexOf(o, a.getRawOrdinalNumber(l)), h = f < 0 ? Number.MIN_VALUE : i(e.indexOfRawIndex(f));
        if (h > s)
          return !0;
        s = h;
      }
      return !1;
    }, t.prototype._isOrderDifferentInView = function(e, i) {
      for (var n = i.scale, a = n.getExtent(), o = Math.max(0, a[0]), s = Math.min(a[1], n.getOrdinalMeta().categories.length - 1); o <= s; ++o)
        if (e.ordinalNumbers[o] !== n.getRawOrdinalNumber(o))
          return !0;
    }, t.prototype._updateSortWithinSameData = function(e, i, n, a) {
      if (this._isOrderChangedWithinSameData(e, i, n)) {
        var o = this._dataSort(e, n, i);
        this._isOrderDifferentInView(o, n) && (this._removeOnRenderedListener(a), a.dispatchAction({
          type: "changeAxisOrder",
          componentType: n.dim + "Axis",
          axisId: n.index,
          sortInfo: o
        }));
      }
    }, t.prototype._dispatchInitSort = function(e, i, n) {
      var a = i.baseAxis, o = this._dataSort(e, a, function(s) {
        return e.get(e.mapDimension(i.otherAxis.dim), s);
      });
      n.dispatchAction({
        type: "changeAxisOrder",
        componentType: a.dim + "Axis",
        isInitSort: !0,
        axisId: a.index,
        sortInfo: o
      });
    }, t.prototype.remove = function(e, i) {
      this._clear(this._model), this._removeOnRenderedListener(i);
    }, t.prototype.dispose = function(e, i) {
      this._removeOnRenderedListener(i);
    }, t.prototype._removeOnRenderedListener = function(e) {
      this._onRendered && (e.getZr().off("rendered", this._onRendered), this._onRendered = null);
    }, t.prototype._clear = function(e) {
      var i = this.group, n = this._data;
      e && e.isAnimationEnabled() && n && !this._isLargeDraw ? (this._removeBackground(), this._backgroundEls = [], n.eachItemGraphicEl(function(a) {
        ff(a, e, J(a).dataIndex);
      })) : i.removeAll(), this._data = null, this._isFirstFrame = !0;
    }, t.prototype._removeBackground = function() {
      this.group.remove(this._backgroundGroup), this._backgroundGroup = null;
    }, t.type = "bar", t;
  })(Et)
), nd = {
  cartesian2d: function(r, t) {
    var e = t.width < 0 ? -1 : 1, i = t.height < 0 ? -1 : 1;
    e < 0 && (t.x += t.width, t.width = -t.width), i < 0 && (t.y += t.height, t.height = -t.height);
    var n = r.x + r.width, a = r.y + r.height, o = hu(t.x, r.x), s = vu(t.x + t.width, n), l = hu(t.y, r.y), u = vu(t.y + t.height, a), f = s < o, h = u < l;
    return t.x = f && o > n ? s : o, t.y = h && l > a ? u : l, t.width = f ? 0 : s - o, t.height = h ? 0 : u - l, e < 0 && (t.x += t.width, t.width = -t.width), i < 0 && (t.y += t.height, t.height = -t.height), f || h;
  },
  polar: function(r, t) {
    var e = t.r0 <= t.r ? 1 : -1;
    if (e < 0) {
      var i = t.r;
      t.r = t.r0, t.r0 = i;
    }
    var n = vu(t.r, r.r), a = hu(t.r0, r.r0);
    t.r = n, t.r0 = a;
    var o = n - a < 0;
    if (e < 0) {
      var i = t.r;
      t.r = t.r0, t.r0 = i;
    }
    return o;
  }
}, ad = {
  cartesian2d: function(r, t, e, i, n, a, o, s, l) {
    var u = new dt({
      shape: k({}, i),
      z2: 1
    });
    if (u.__dataIndex = e, u.name = "item", a) {
      var f = u.shape, h = n ? "height" : "width";
      f[h] = 0;
    }
    return u;
  },
  polar: function(r, t, e, i, n, a, o, s, l) {
    var u = !n && l ? id : mi, f = new u({
      shape: i,
      z2: 1
    });
    f.name = "item";
    var h = J0(n);
    if (f.calculateTextPosition = hA(h, {
      isRoundCap: u === id
    }), a) {
      var c = f.shape, v = n ? "r" : "endAngle", p = {};
      c[v] = n ? i.r0 : i.startAngle, p[v] = i[v], (s ? Wt : Oe)(f, {
        shape: p
        // __value: typeof dataValue === 'string' ? parseInt(dataValue, 10) : dataValue
      }, a);
    }
    return f;
  }
};
function gA(r, t) {
  var e = r.get("realtimeSort", !0), i = t.getBaseAxis();
  if (e && i.type === "category" && t.type === "cartesian2d")
    return {
      baseAxis: i,
      otherAxis: t.getOtherAxis(i)
    };
}
function od(r, t, e, i, n, a, o, s) {
  var l, u;
  a ? (u = {
    x: i.x,
    width: i.width
  }, l = {
    y: i.y,
    height: i.height
  }) : (u = {
    y: i.y,
    height: i.height
  }, l = {
    x: i.x,
    width: i.width
  }), s || (o ? Wt : Oe)(e, {
    shape: l
  }, t, n, null);
  var f = t ? r.baseAxis.model : null;
  (o ? Wt : Oe)(e, {
    shape: u
  }, f, n);
}
function sd(r, t) {
  for (var e = 0; e < t.length; e++)
    if (!isFinite(r[t[e]]))
      return !0;
  return !1;
}
var yA = ["x", "y", "width", "height"], mA = ["cx", "cy", "r", "startAngle", "endAngle"], ld = {
  cartesian2d: function(r) {
    return !sd(r, yA);
  },
  polar: function(r) {
    return !sd(r, mA);
  }
}, mo = {
  // itemModel is only used to get borderWidth, which is not needed
  // when calculating bar background layout.
  cartesian2d: function(r, t, e) {
    var i = r.getItemLayout(t), n = e ? SA(e, i) : 0, a = i.width > 0 ? 1 : -1, o = i.height > 0 ? 1 : -1;
    return {
      x: i.x + a * n / 2,
      y: i.y + o * n / 2,
      width: i.width - a * n,
      height: i.height - o * n
    };
  },
  polar: function(r, t, e) {
    var i = r.getItemLayout(t);
    return {
      cx: i.cx,
      cy: i.cy,
      r0: i.r0,
      r: i.r,
      startAngle: i.startAngle,
      endAngle: i.endAngle,
      clockwise: i.clockwise
    };
  }
};
function _A(r) {
  return r.startAngle != null && r.endAngle != null && r.startAngle === r.endAngle;
}
function J0(r) {
  return /* @__PURE__ */ (function(t) {
    var e = t ? "Arc" : "Angle";
    return function(i) {
      switch (i) {
        case "start":
        case "insideStart":
        case "end":
        case "insideEnd":
          return i + e;
        default:
          return i;
      }
    };
  })(r);
}
function ud(r, t, e, i, n, a, o, s) {
  var l = t.getItemVisual(e, "style");
  if (s) {
    if (!a.get("roundCap")) {
      var f = r.shape, h = cA(i.getModel("itemStyle"), f);
      k(f, h), r.setShape(f);
    }
  } else {
    var u = i.get(["itemStyle", "borderRadius"]) || 0;
    r.setShape("r", u);
  }
  r.useStyle(l);
  var c = i.getShallow("cursor");
  c && r.attr("cursor", c);
  var v = s ? o ? n.r >= n.r0 ? "endArc" : "startArc" : n.endAngle >= n.startAngle ? "endAngle" : "startAngle" : o ? n.height >= 0 ? "bottom" : "top" : n.width >= 0 ? "right" : "left", p = Dr(i);
  nn(r, p, {
    labelFetcher: a,
    labelDataIndex: e,
    defaultText: iv(a.getData(), e),
    inheritColor: l.fill,
    defaultOpacity: l.opacity,
    defaultOutsidePosition: v
  });
  var g = r.getTextContent();
  if (s && g) {
    var d = i.get(["label", "position"]);
    r.textConfig.inside = d === "middle" ? !0 : null, vA(r, d === "outside" ? v : d, J0(o), i.get(["label", "rotate"]));
  }
  qw(g, p, a.getRawValue(e), function(m) {
    return W0(t, m);
  });
  var y = i.getModel(["emphasis"]);
  Ji(r, y.get("focus"), y.get("blurScope"), y.get("disabled")), of(r, i), _A(n) && (r.style.fill = "none", r.style.stroke = "none", T(r.states, function(m) {
    m.style && (m.style.fill = m.style.stroke = "none");
  }));
}
function SA(r, t) {
  var e = r.get(["itemStyle", "borderColor"]);
  if (!e || e === "none")
    return 0;
  var i = r.get(["itemStyle", "borderWidth"]) || 0, n = isNaN(t.width) ? Number.MAX_VALUE : Math.abs(t.width), a = isNaN(t.height) ? Number.MAX_VALUE : Math.abs(t.height);
  return Math.min(i, n, a);
}
var bA = (
  /** @class */
  /* @__PURE__ */ (function() {
    function r() {
    }
    return r;
  })()
), fd = (
  /** @class */
  (function(r) {
    F(t, r);
    function t(e) {
      var i = r.call(this, e) || this;
      return i.type = "largeBar", i;
    }
    return t.prototype.getDefaultShape = function() {
      return new bA();
    }, t.prototype.buildPath = function(e, i) {
      for (var n = i.points, a = this.baseDimIdx, o = 1 - this.baseDimIdx, s = [], l = [], u = this.barWidth, f = 0; f < n.length; f += 3)
        l[a] = u, l[o] = n[f + 2], s[a] = n[f + a], s[o] = n[f + o], e.rect(s[0], s[1], l[0], l[1]);
    }, t;
  })(ot)
);
function hd(r, t, e, i) {
  var n = r.getData(), a = n.getLayout("valueAxisHorizontal") ? 1 : 0, o = n.getLayout("largeDataIndices"), s = n.getLayout("size"), l = r.getModel("backgroundStyle"), u = n.getLayout("largeBackgroundPoints");
  if (u) {
    var f = new fd({
      shape: {
        points: u
      },
      incremental: !!i,
      silent: !0,
      z2: 0
    });
    f.baseDimIdx = a, f.largeDataIndices = o, f.barWidth = s, f.useStyle(l.getItemStyle()), t.add(f), e && e.push(f);
  }
  var h = new fd({
    shape: {
      points: n.getLayout("largePoints")
    },
    incremental: !!i,
    ignoreCoarsePointer: !0,
    z2: 1
  });
  h.baseDimIdx = a, h.largeDataIndices = o, h.barWidth = s, t.add(h), h.useStyle(n.getVisual("style")), h.style.stroke = null, J(h).seriesIndex = r.seriesIndex, r.get("silent") || (h.on("mousedown", vd), h.on("mousemove", vd)), e && e.push(h);
}
var vd = qs(function(r) {
  var t = this, e = wA(t, r.offsetX, r.offsetY);
  J(t).dataIndex = e >= 0 ? e : null;
}, 30, !1);
function wA(r, t, e) {
  for (var i = r.baseDimIdx, n = 1 - i, a = r.shape.points, o = r.largeDataIndices, s = [], l = [], u = r.barWidth, f = 0, h = a.length / 3; f < h; f++) {
    var c = f * 3;
    if (l[i] = u, l[n] = a[c + 2], s[i] = a[c + i], s[n] = a[c + n], l[n] < 0 && (s[n] += l[n], l[n] = -l[n]), t >= s[0] && t <= s[0] + l[0] && e >= s[1] && e <= s[1] + l[1])
      return o[f];
  }
  return -1;
}
function j0(r, t, e) {
  if (Oa(e, "cartesian2d")) {
    var i = t, n = e.getArea();
    return {
      x: r ? i.x : n.x,
      y: r ? n.y : i.y,
      width: r ? i.width : n.width,
      height: r ? n.height : i.height
    };
  } else {
    var n = e.getArea(), a = t;
    return {
      cx: n.cx,
      cy: n.cy,
      r0: r ? n.r0 : a.r0,
      r: r ? n.r : a.r,
      startAngle: r ? a.startAngle : 0,
      endAngle: r ? a.endAngle : Math.PI * 2
    };
  }
}
function xA(r, t, e) {
  var i = r.type === "polar" ? mi : dt;
  return new i({
    shape: j0(t, e, r),
    silent: !0,
    z2: 0
  });
}
function TA(r) {
  r.registerChartView(dA), r.registerSeriesModel(uA), r.registerLayout(r.PRIORITY.VISUAL.LAYOUT, ht(VM, "bar")), r.registerLayout(r.PRIORITY.VISUAL.PROGRESSIVE_LAYOUT, HM("bar")), r.registerProcessor(r.PRIORITY.PROCESSOR.STATISTIC, Q0("bar")), r.registerAction({
    type: "changeAxisOrder",
    event: "changeAxisOrder",
    update: "update"
  }, function(t, e) {
    var i = t.componentType || "series";
    e.eachComponent({
      mainType: i,
      query: t
    }, function(n) {
      t.sortInfo && n.axis.setCategorySortInfo(t.sortInfo);
    });
  });
}
var CA = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e.hasSymbolVisual = !0, e;
    }
    return t.prototype.getInitialData = function(e, i) {
      return sn(null, this, {
        useEncodeDefaulter: !0
      });
    }, t.prototype.getProgressive = function() {
      var e = this.option.progressive;
      return e ?? (this.option.large ? 5e3 : this.get("progressive"));
    }, t.prototype.getProgressiveThreshold = function() {
      var e = this.option.progressiveThreshold;
      return e ?? (this.option.large ? 1e4 : this.get("progressiveThreshold"));
    }, t.prototype.brushSelector = function(e, i, n) {
      return n.point(i.getItemLayout(e));
    }, t.prototype.getZLevelKey = function() {
      return this.getData().count() > this.getProgressiveThreshold() ? this.id : "";
    }, t.type = "series.scatter", t.dependencies = ["grid", "polar", "geo", "singleAxis", "calendar"], t.defaultOption = {
      coordinateSystem: "cartesian2d",
      // zlevel: 0,
      z: 2,
      legendHoverLink: !0,
      symbolSize: 10,
      // symbolRotate: null,  // 图形旋转控制
      large: !1,
      // Available when large is true
      largeThreshold: 2e3,
      // cursor: null,
      itemStyle: {
        opacity: 0.8
        // color: 各异
      },
      emphasis: {
        scale: !0
      },
      // If clip the overflow graphics
      // Works on cartesian / polar series
      clip: !0,
      select: {
        itemStyle: {
          borderColor: "#212121"
        }
      },
      universalTransition: {
        divideShape: "clone"
      }
      // progressive: null
    }, t;
  })(Ut)
), t_ = 4, MA = (
  /** @class */
  /* @__PURE__ */ (function() {
    function r() {
    }
    return r;
  })()
), DA = (
  /** @class */
  (function(r) {
    F(t, r);
    function t(e) {
      var i = r.call(this, e) || this;
      return i._off = 0, i.hoverDataIdx = -1, i;
    }
    return t.prototype.getDefaultShape = function() {
      return new MA();
    }, t.prototype.reset = function() {
      this.notClear = !1, this._off = 0;
    }, t.prototype.buildPath = function(e, i) {
      var n = i.points, a = i.size, o = this.symbolProxy, s = o.shape, l = e.getContext ? e.getContext() : e, u = l && a[0] < t_, f = this.softClipShape, h;
      if (u) {
        this._ctx = l;
        return;
      }
      for (this._ctx = null, h = this._off; h < n.length; ) {
        var c = n[h++], v = n[h++];
        isNaN(c) || isNaN(v) || f && !f.contain(c, v) || (s.x = c - a[0] / 2, s.y = v - a[1] / 2, s.width = a[0], s.height = a[1], o.buildPath(e, s, !0));
      }
      this.incremental && (this._off = h, this.notClear = !0);
    }, t.prototype.afterBrush = function() {
      var e = this.shape, i = e.points, n = e.size, a = this._ctx, o = this.softClipShape, s;
      if (a) {
        for (s = this._off; s < i.length; ) {
          var l = i[s++], u = i[s++];
          isNaN(l) || isNaN(u) || o && !o.contain(l, u) || a.fillRect(l - n[0] / 2, u - n[1] / 2, n[0], n[1]);
        }
        this.incremental && (this._off = s, this.notClear = !0);
      }
    }, t.prototype.findDataIndex = function(e, i) {
      for (var n = this.shape, a = n.points, o = n.size, s = Math.max(o[0], 4), l = Math.max(o[1], 4), u = a.length / 2 - 1; u >= 0; u--) {
        var f = u * 2, h = a[f] - s / 2, c = a[f + 1] - l / 2;
        if (e >= h && i >= c && e <= h + s && i <= c + l)
          return u;
      }
      return -1;
    }, t.prototype.contain = function(e, i) {
      var n = this.transformCoordToLocal(e, i), a = this.getBoundingRect();
      if (e = n[0], i = n[1], a.contain(e, i)) {
        var o = this.hoverDataIdx = this.findDataIndex(e, i);
        return o >= 0;
      }
      return this.hoverDataIdx = -1, !1;
    }, t.prototype.getBoundingRect = function() {
      var e = this._rect;
      if (!e) {
        for (var i = this.shape, n = i.points, a = i.size, o = a[0], s = a[1], l = 1 / 0, u = 1 / 0, f = -1 / 0, h = -1 / 0, c = 0; c < n.length; ) {
          var v = n[c++], p = n[c++];
          l = Math.min(v, l), f = Math.max(v, f), u = Math.min(p, u), h = Math.max(p, h);
        }
        e = this._rect = new it(l - o / 2, u - s / 2, f - l + o, h - u + s);
      }
      return e;
    }, t;
  })(ot)
), AA = (
  /** @class */
  (function() {
    function r() {
      this.group = new gt();
    }
    return r.prototype.updateData = function(t, e) {
      this._clear();
      var i = this._create();
      i.setShape({
        points: t.getLayout("points")
      }), this._setCommon(i, t, e);
    }, r.prototype.updateLayout = function(t) {
      var e = t.getLayout("points");
      this.group.eachChild(function(i) {
        if (i.startIndex != null) {
          var n = (i.endIndex - i.startIndex) * 2, a = i.startIndex * 4 * 2;
          e = new Float32Array(e.buffer, a, n);
        }
        i.setShape("points", e), i.reset();
      });
    }, r.prototype.incrementalPrepareUpdate = function(t) {
      this._clear();
    }, r.prototype.incrementalUpdate = function(t, e, i) {
      var n = this._newAdded[0], a = e.getLayout("points"), o = n && n.shape.points;
      if (o && o.length < 2e4) {
        var s = o.length, l = new Float32Array(s + a.length);
        l.set(o), l.set(a, s), n.endIndex = t.end, n.setShape({
          points: l
        });
      } else {
        this._newAdded = [];
        var u = this._create();
        u.startIndex = t.start, u.endIndex = t.end, u.incremental = !0, u.setShape({
          points: a
        }), this._setCommon(u, e, i);
      }
    }, r.prototype.eachRendered = function(t) {
      this._newAdded[0] && t(this._newAdded[0]);
    }, r.prototype._create = function() {
      var t = new DA({
        cursor: "default"
      });
      return t.ignoreCoarsePointer = !0, this.group.add(t), this._newAdded.push(t), t;
    }, r.prototype._setCommon = function(t, e, i) {
      var n = e.hostModel;
      i = i || {};
      var a = e.getVisual("symbolSize");
      t.setShape("size", a instanceof Array ? a : [a, a]), t.softClipShape = i.clipShape || null, t.symbolProxy = ge(e.getVisual("symbol"), 0, 0, 0, 0), t.setColor = t.symbolProxy.setColor;
      var o = t.shape.size[0] < t_;
      t.useStyle(
        // Draw shadow when doing fillRect is extremely slow.
        n.getModel("itemStyle").getItemStyle(o ? ["color", "shadowBlur", "shadowColor"] : ["color"])
      );
      var s = e.getVisual("style"), l = s && s.fill;
      l && t.setColor(l);
      var u = J(t);
      u.seriesIndex = n.seriesIndex, t.on("mousemove", function(f) {
        u.dataIndex = null;
        var h = t.hoverDataIdx;
        h >= 0 && (u.dataIndex = h + (t.startIndex || 0));
      });
    }, r.prototype.remove = function() {
      this._clear();
    }, r.prototype._clear = function() {
      this._newAdded = [], this.group.removeAll();
    }, r;
  })()
), IA = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e;
    }
    return t.prototype.render = function(e, i, n) {
      var a = e.getData(), o = this._updateSymbolDraw(a, e);
      o.updateData(a, {
        // TODO
        // If this parameter should be a shape or a bounding volume
        // shape will be more general.
        // But bounding volume like bounding rect will be much faster in the contain calculation
        clipShape: this._getClipShape(e)
      }), this._finished = !0;
    }, t.prototype.incrementalPrepareRender = function(e, i, n) {
      var a = e.getData(), o = this._updateSymbolDraw(a, e);
      o.incrementalPrepareUpdate(a), this._finished = !1;
    }, t.prototype.incrementalRender = function(e, i, n) {
      this._symbolDraw.incrementalUpdate(e, i.getData(), {
        clipShape: this._getClipShape(i)
      }), this._finished = e.end === i.getData().count();
    }, t.prototype.updateTransform = function(e, i, n) {
      var a = e.getData();
      if (this.group.dirty(), !this._finished || a.count() > 1e4)
        return {
          update: !0
        };
      var o = av("").reset(e, i, n);
      o.progress && o.progress({
        start: 0,
        end: a.count(),
        count: a.count()
      }, a), this._symbolDraw.updateLayout(a);
    }, t.prototype.eachRendered = function(e) {
      this._symbolDraw && this._symbolDraw.eachRendered(e);
    }, t.prototype._getClipShape = function(e) {
      if (e.get("clip", !0)) {
        var i = e.coordinateSystem;
        return i && i.getArea && i.getArea(0.1);
      }
    }, t.prototype._updateSymbolDraw = function(e, i) {
      var n = this._symbolDraw, a = i.pipelineContext, o = a.large;
      return (!n || o !== this._isLargeDraw) && (n && n.remove(), n = this._symbolDraw = o ? new AA() : new U0(), this._isLargeDraw = o, this.group.removeAll()), this.group.add(n.group), n;
    }, t.prototype.remove = function(e, i) {
      this._symbolDraw && this._symbolDraw.remove(!0), this._symbolDraw = null;
    }, t.prototype.dispose = function() {
    }, t.type = "scatter", t;
  })(Et)
), LA = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      return r !== null && r.apply(this, arguments) || this;
    }
    return t.type = "grid", t.dependencies = ["xAxis", "yAxis"], t.layoutMode = "box", t.defaultOption = {
      show: !1,
      // zlevel: 0,
      z: 0,
      left: "10%",
      top: 60,
      right: "10%",
      bottom: 70,
      // If grid size contain label
      containLabel: !1,
      // width: {totalWidth} - left - right,
      // height: {totalHeight} - top - bottom,
      backgroundColor: "rgba(0,0,0,0)",
      borderWidth: 1,
      borderColor: "#ccc"
    }, t;
  })(rt)
), Rf = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      return r !== null && r.apply(this, arguments) || this;
    }
    return t.prototype.getCoordSysModel = function() {
      return this.getReferringComponents("grid", Ae).models[0];
    }, t.type = "cartesian2dAxis", t;
  })(rt)
);
ie(Rf, R0);
var e_ = {
  show: !0,
  // zlevel: 0,
  z: 0,
  // Inverse the axis.
  inverse: !1,
  // Axis name displayed.
  name: "",
  // 'start' | 'middle' | 'end'
  nameLocation: "end",
  // By degree. By default auto rotate by nameLocation.
  nameRotate: null,
  nameTruncate: {
    maxWidth: null,
    ellipsis: "...",
    placeholder: "."
  },
  // Use global text style by default.
  nameTextStyle: {},
  // The gap between axisName and axisLine.
  nameGap: 15,
  // Default `false` to support tooltip.
  silent: !1,
  // Default `false` to avoid legacy user event listener fail.
  triggerEvent: !1,
  tooltip: {
    show: !1
  },
  axisPointer: {},
  axisLine: {
    show: !0,
    onZero: !0,
    onZeroAxisIndex: null,
    lineStyle: {
      color: "#6E7079",
      width: 1,
      type: "solid"
    },
    // The arrow at both ends the the axis.
    symbol: ["none", "none"],
    symbolSize: [10, 15]
  },
  axisTick: {
    show: !0,
    // Whether axisTick is inside the grid or outside the grid.
    inside: !1,
    // The length of axisTick.
    length: 5,
    lineStyle: {
      width: 1
    }
  },
  axisLabel: {
    show: !0,
    // Whether axisLabel is inside the grid or outside the grid.
    inside: !1,
    rotate: 0,
    // true | false | null/undefined (auto)
    showMinLabel: null,
    // true | false | null/undefined (auto)
    showMaxLabel: null,
    margin: 8,
    // formatter: null,
    fontSize: 12
  },
  splitLine: {
    show: !0,
    showMinLine: !0,
    showMaxLine: !0,
    lineStyle: {
      color: ["#E0E6F1"],
      width: 1,
      type: "solid"
    }
  },
  splitArea: {
    show: !1,
    areaStyle: {
      color: ["rgba(250,250,250,0.2)", "rgba(210,219,238,0.2)"]
    }
  }
}, PA = j({
  // The gap at both ends of the axis. For categoryAxis, boolean.
  boundaryGap: !0,
  // Set false to faster category collection.
  deduplication: null,
  // splitArea: {
  // show: false
  // },
  splitLine: {
    show: !1
  },
  axisTick: {
    // If tick is align with label when boundaryGap is true
    alignWithLabel: !1,
    interval: "auto"
  },
  axisLabel: {
    interval: "auto"
  }
}, e_), ov = j({
  boundaryGap: [0, 0],
  axisLine: {
    // Not shown when other axis is categoryAxis in cartesian
    show: "auto"
  },
  axisTick: {
    // Not shown when other axis is categoryAxis in cartesian
    show: "auto"
  },
  // TODO
  // min/max: [30, datamin, 60] or [20, datamin] or [datamin, 60]
  splitNumber: 5,
  minorTick: {
    // Minor tick, not available for cateogry axis.
    show: !1,
    // Split number of minor ticks. The value should be in range of (0, 100)
    splitNumber: 5,
    // Length of minor tick
    length: 3,
    // Line style
    lineStyle: {
      // Default to be same with axisTick
    }
  },
  minorSplitLine: {
    show: !1,
    lineStyle: {
      color: "#F4F7FD",
      width: 1
    }
  }
}, e_), RA = j({
  splitNumber: 6,
  axisLabel: {
    // To eliminate labels that are not nice
    showMinLabel: !1,
    showMaxLabel: !1,
    rich: {
      primary: {
        fontWeight: "bold"
      }
    }
  },
  splitLine: {
    show: !1
  }
}, ov), EA = at({
  logBase: 10
}, ov);
const OA = {
  category: PA,
  value: ov,
  time: RA,
  log: EA
};
var kA = {
  value: 1,
  category: 1,
  time: 1,
  log: 1
};
function cd(r, t, e, i) {
  T(kA, function(n, a) {
    var o = j(j({}, OA[a], !0), i, !0), s = (
      /** @class */
      (function(l) {
        F(u, l);
        function u() {
          var f = l !== null && l.apply(this, arguments) || this;
          return f.type = t + "Axis." + a, f;
        }
        return u.prototype.mergeDefaultAndTheme = function(f, h) {
          var c = ha(this), v = c ? Xs(f) : {}, p = h.getTheme();
          j(f, p.get(a + "Axis")), j(f, this.getDefaultOption()), f.type = pd(f), c && ji(f, v, c);
        }, u.prototype.optionUpdated = function() {
          var f = this.option;
          f.type === "category" && (this.__ordinalMeta = Df.createByAxisModel(this));
        }, u.prototype.getCategories = function(f) {
          var h = this.option;
          if (h.type === "category")
            return f ? h.data : this.__ordinalMeta.categories;
        }, u.prototype.getOrdinalMeta = function() {
          return this.__ordinalMeta;
        }, u.type = t + "Axis." + a, u.defaultOption = o, u;
      })(e)
    );
    r.registerComponentModel(s);
  }), r.registerSubTypeDefaulter(t + "Axis", pd);
}
function pd(r) {
  return r.type || (r.data ? "category" : "value");
}
var NA = (
  /** @class */
  (function() {
    function r(t) {
      this.type = "cartesian", this._dimList = [], this._axes = {}, this.name = t || "";
    }
    return r.prototype.getAxis = function(t) {
      return this._axes[t];
    }, r.prototype.getAxes = function() {
      return z(this._dimList, function(t) {
        return this._axes[t];
      }, this);
    }, r.prototype.getAxesByScale = function(t) {
      return t = t.toLowerCase(), xt(this.getAxes(), function(e) {
        return e.scale.type === t;
      });
    }, r.prototype.addAxis = function(t) {
      var e = t.dim;
      this._axes[e] = t, this._dimList.push(e);
    }, r;
  })()
), Ef = ["x", "y"];
function dd(r) {
  return r.type === "interval" || r.type === "time";
}
var BA = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = "cartesian2d", e.dimensions = Ef, e;
    }
    return t.prototype.calcAffineTransform = function() {
      this._transform = this._invTransform = null;
      var e = this.getAxis("x").scale, i = this.getAxis("y").scale;
      if (!(!dd(e) || !dd(i))) {
        var n = e.getExtent(), a = i.getExtent(), o = this.dataToPoint([n[0], a[0]]), s = this.dataToPoint([n[1], a[1]]), l = n[1] - n[0], u = a[1] - a[0];
        if (!(!l || !u)) {
          var f = (s[0] - o[0]) / l, h = (s[1] - o[1]) / u, c = o[0] - n[0] * f, v = o[1] - a[0] * h, p = this._transform = [f, 0, 0, h, c, v];
          this._invTransform = wa([], p);
        }
      }
    }, t.prototype.getBaseAxis = function() {
      return this.getAxesByScale("ordinal")[0] || this.getAxesByScale("time")[0] || this.getAxis("x");
    }, t.prototype.containPoint = function(e) {
      var i = this.getAxis("x"), n = this.getAxis("y");
      return i.contain(i.toLocalCoord(e[0])) && n.contain(n.toLocalCoord(e[1]));
    }, t.prototype.containData = function(e) {
      return this.getAxis("x").containData(e[0]) && this.getAxis("y").containData(e[1]);
    }, t.prototype.containZone = function(e, i) {
      var n = this.dataToPoint(e), a = this.dataToPoint(i), o = this.getArea(), s = new it(n[0], n[1], a[0] - n[0], a[1] - n[1]);
      return o.intersect(s);
    }, t.prototype.dataToPoint = function(e, i, n) {
      n = n || [];
      var a = e[0], o = e[1];
      if (this._transform && a != null && isFinite(a) && o != null && isFinite(o))
        return Vt(n, e, this._transform);
      var s = this.getAxis("x"), l = this.getAxis("y");
      return n[0] = s.toGlobalCoord(s.dataToCoord(a, i)), n[1] = l.toGlobalCoord(l.dataToCoord(o, i)), n;
    }, t.prototype.clampData = function(e, i) {
      var n = this.getAxis("x").scale, a = this.getAxis("y").scale, o = n.getExtent(), s = a.getExtent(), l = n.parse(e[0]), u = a.parse(e[1]);
      return i = i || [], i[0] = Math.min(Math.max(Math.min(o[0], o[1]), l), Math.max(o[0], o[1])), i[1] = Math.min(Math.max(Math.min(s[0], s[1]), u), Math.max(s[0], s[1])), i;
    }, t.prototype.pointToData = function(e, i) {
      var n = [];
      if (this._invTransform)
        return Vt(n, e, this._invTransform);
      var a = this.getAxis("x"), o = this.getAxis("y");
      return n[0] = a.coordToData(a.toLocalCoord(e[0]), i), n[1] = o.coordToData(o.toLocalCoord(e[1]), i), n;
    }, t.prototype.getOtherAxis = function(e) {
      return this.getAxis(e.dim === "x" ? "y" : "x");
    }, t.prototype.getArea = function(e) {
      e = e || 0;
      var i = this.getAxis("x").getGlobalExtent(), n = this.getAxis("y").getGlobalExtent(), a = Math.min(i[0], i[1]) - e, o = Math.min(n[0], n[1]) - e, s = Math.max(i[0], i[1]) - a + e, l = Math.max(n[0], n[1]) - o + e;
      return new it(a, o, s, l);
    }, t;
  })(NA)
), zA = (
  /** @class */
  (function(r) {
    F(t, r);
    function t(e, i, n, a, o) {
      var s = r.call(this, e, i, n) || this;
      return s.index = 0, s.type = a || "value", s.position = o || "bottom", s;
    }
    return t.prototype.isHorizontal = function() {
      var e = this.position;
      return e === "top" || e === "bottom";
    }, t.prototype.getGlobalExtent = function(e) {
      var i = this.getExtent();
      return i[0] = this.toGlobalCoord(i[0]), i[1] = this.toGlobalCoord(i[1]), e && i[0] > i[1] && i.reverse(), i;
    }, t.prototype.pointToData = function(e, i) {
      return this.coordToData(this.toLocalCoord(e[this.dim === "x" ? 0 : 1]), i);
    }, t.prototype.setCategorySortInfo = function(e) {
      if (this.type !== "category")
        return !1;
      this.model.option.categorySortInfo = e, this.scale.setSortInfo(e);
    }, t;
  })(G0)
);
function Of(r, t, e) {
  e = e || {};
  var i = r.coordinateSystem, n = t.axis, a = {}, o = n.getAxesOnZeroOf()[0], s = n.position, l = o ? "onZero" : s, u = n.dim, f = i.getRect(), h = [f.x, f.x + f.width, f.y, f.y + f.height], c = {
    left: 0,
    right: 1,
    top: 0,
    bottom: 1,
    onZero: 2
  }, v = t.get("offset") || 0, p = u === "x" ? [h[2] - v, h[3] + v] : [h[0] - v, h[1] + v];
  if (o) {
    var g = o.toGlobalCoord(o.dataToCoord(0));
    p[c.onZero] = Math.max(Math.min(g, p[1]), p[0]);
  }
  a.position = [u === "y" ? p[c[l]] : h[0], u === "x" ? p[c[l]] : h[3]], a.rotation = Math.PI / 2 * (u === "x" ? 0 : 1);
  var d = {
    top: -1,
    bottom: 1,
    left: -1,
    right: 1
  };
  a.labelDirection = a.tickDirection = a.nameDirection = d[s], a.labelOffset = o ? p[c[s]] - p[c.onZero] : 0, t.get(["axisTick", "inside"]) && (a.tickDirection = -a.tickDirection), Cr(e.labelInside, t.get(["axisLabel", "inside"])) && (a.labelDirection = -a.labelDirection);
  var y = t.get(["axisLabel", "rotate"]);
  return a.labelRotate = l === "top" ? -y : y, a.z2 = 1, a;
}
function gd(r) {
  return r.get("coordinateSystem") === "cartesian2d";
}
function yd(r) {
  var t = {
    xAxisModel: null,
    yAxisModel: null
  };
  return T(t, function(e, i) {
    var n = i.replace(/Model$/, ""), a = r.getReferringComponents(n, Ae).models[0];
    t[i] = a;
  }), t;
}
var cu = Math.log;
function FA(r, t, e) {
  var i = ln.prototype, n = i.getTicks.call(e), a = i.getTicks.call(e, !0), o = n.length - 1, s = i.getInterval.call(e), l = I0(r, t), u = l.extent, f = l.fixMin, h = l.fixMax;
  if (r.type === "log") {
    var c = cu(r.base);
    u = [cu(u[0]) / c, cu(u[1]) / c];
  }
  r.setExtent(u[0], u[1]), r.calcNiceExtent({
    splitNumber: o,
    fixMin: f,
    fixMax: h
  });
  var v = i.getExtent.call(r);
  f && (u[0] = v[0]), h && (u[1] = v[1]);
  var p = i.getInterval.call(r), g = u[0], d = u[1];
  if (f && h)
    p = (d - g) / o;
  else if (f)
    for (d = u[0] + p * o; d < u[1] && isFinite(d) && isFinite(u[1]); )
      p = ou(p), d = u[0] + p * o;
  else if (h)
    for (g = u[1] - p * o; g > u[0] && isFinite(g) && isFinite(u[0]); )
      p = ou(p), g = u[1] - p * o;
  else {
    var y = r.getTicks().length - 1;
    y > o && (p = ou(p));
    var m = p * o;
    d = Math.ceil(u[1] / p) * p, g = St(d - m), g < 0 && u[0] >= 0 ? (g = 0, d = St(m)) : d > 0 && u[1] <= 0 && (d = 0, g = -St(m));
  }
  var _ = (n[0].value - a[0].value) / s, S = (n[o].value - a[o].value) / s;
  i.setExtent.call(r, g + p * _, d + p * S), i.setInterval.call(r, p), (_ || S) && i.setNiceExtent.call(r, g + p, d - p);
}
var VA = (
  /** @class */
  (function() {
    function r(t, e, i) {
      this.type = "grid", this._coordsMap = {}, this._coordsList = [], this._axesMap = {}, this._axesList = [], this.axisPointerEnabled = !0, this.dimensions = Ef, this._initCartesian(t, e, i), this.model = t;
    }
    return r.prototype.getRect = function() {
      return this._rect;
    }, r.prototype.update = function(t, e) {
      var i = this._axesMap;
      this._updateScale(t, this.model);
      function n(o) {
        var s, l = ct(o), u = l.length;
        if (u) {
          for (var f = [], h = u - 1; h >= 0; h--) {
            var c = +l[h], v = o[c], p = v.model, g = v.scale;
            // Only value and log axis without interval support alignTicks.
            Af(g) && p.get("alignTicks") && p.get("interval") == null ? f.push(v) : (If(g, p), Af(g) && (s = v));
          }
          f.length && (s || (s = f.pop(), If(s.scale, s.model)), T(f, function(d) {
            FA(d.scale, d.model, s.scale);
          }));
        }
      }
      n(i.x), n(i.y);
      var a = {};
      T(i.x, function(o) {
        md(i, "y", o, a);
      }), T(i.y, function(o) {
        md(i, "x", o, a);
      }), this.resize(this.model, e);
    }, r.prototype.resize = function(t, e, i) {
      var n = t.getBoxLayoutParams(), a = !i && t.get("containLabel"), o = Ar(n, {
        width: e.getWidth(),
        height: e.getHeight()
      });
      this._rect = o;
      var s = this._axesList;
      l(), a && (T(s, function(u) {
        if (!u.model.get(["axisLabel", "inside"])) {
          var f = oD(u);
          if (f) {
            var h = u.isHorizontal() ? "height" : "width", c = u.model.get(["axisLabel", "margin"]);
            o[h] -= f[h] + c, u.position === "top" ? o.y += f.height + c : u.position === "left" && (o.x += f.width + c);
          }
        }
      }), l()), T(this._coordsList, function(u) {
        u.calcAffineTransform();
      });
      function l() {
        T(s, function(u) {
          var f = u.isHorizontal(), h = f ? [0, o.width] : [0, o.height], c = u.inverse ? 1 : 0;
          u.setExtent(h[c], h[1 - c]), HA(u, f ? o.x : o.y);
        });
      }
    }, r.prototype.getAxis = function(t, e) {
      var i = this._axesMap[t];
      if (i != null)
        return i[e || 0];
    }, r.prototype.getAxes = function() {
      return this._axesList.slice();
    }, r.prototype.getCartesian = function(t, e) {
      if (t != null && e != null) {
        var i = "x" + t + "y" + e;
        return this._coordsMap[i];
      }
      H(t) && (e = t.yAxisIndex, t = t.xAxisIndex);
      for (var n = 0, a = this._coordsList; n < a.length; n++)
        if (a[n].getAxis("x").index === t || a[n].getAxis("y").index === e)
          return a[n];
    }, r.prototype.getCartesians = function() {
      return this._coordsList.slice();
    }, r.prototype.convertToPixel = function(t, e, i) {
      var n = this._findConvertTarget(e);
      return n.cartesian ? n.cartesian.dataToPoint(i) : n.axis ? n.axis.toGlobalCoord(n.axis.dataToCoord(i)) : null;
    }, r.prototype.convertFromPixel = function(t, e, i) {
      var n = this._findConvertTarget(e);
      return n.cartesian ? n.cartesian.pointToData(i) : n.axis ? n.axis.coordToData(n.axis.toLocalCoord(i)) : null;
    }, r.prototype._findConvertTarget = function(t) {
      var e = t.seriesModel, i = t.xAxisModel || e && e.getReferringComponents("xAxis", Ae).models[0], n = t.yAxisModel || e && e.getReferringComponents("yAxis", Ae).models[0], a = t.gridModel, o = this._coordsList, s, l;
      if (e)
        s = e.coordinateSystem, nt(o, s) < 0 && (s = null);
      else if (i && n)
        s = this.getCartesian(i.componentIndex, n.componentIndex);
      else if (i)
        l = this.getAxis("x", i.componentIndex);
      else if (n)
        l = this.getAxis("y", n.componentIndex);
      else if (a) {
        var u = a.coordinateSystem;
        u === this && (s = this._coordsList[0]);
      }
      return {
        cartesian: s,
        axis: l
      };
    }, r.prototype.containPoint = function(t) {
      var e = this._coordsList[0];
      if (e)
        return e.containPoint(t);
    }, r.prototype._initCartesian = function(t, e, i) {
      var n = this, a = this, o = {
        left: !1,
        right: !1,
        top: !1,
        bottom: !1
      }, s = {
        x: {},
        y: {}
      }, l = {
        x: 0,
        y: 0
      };
      if (e.eachComponent("xAxis", u("x"), this), e.eachComponent("yAxis", u("y"), this), !l.x || !l.y) {
        this._axesMap = {}, this._axesList = [];
        return;
      }
      this._axesMap = s, T(s.x, function(f, h) {
        T(s.y, function(c, v) {
          var p = "x" + h + "y" + v, g = new BA(p);
          g.master = n, g.model = t, n._coordsMap[p] = g, n._coordsList.push(g), g.addAxis(f), g.addAxis(c);
        });
      });
      function u(f) {
        return function(h, c) {
          if (pu(h, t)) {
            var v = h.get("position");
            f === "x" ? v !== "top" && v !== "bottom" && (v = o.bottom ? "top" : "bottom") : v !== "left" && v !== "right" && (v = o.left ? "right" : "left"), o[v] = !0;
            var p = new zA(f, L0(h), [0, 0], h.get("type"), v), g = p.type === "category";
            p.onBand = g && h.get("boundaryGap"), p.inverse = h.get("inverse"), h.axis = p, p.model = h, p.grid = a, p.index = c, a._axesList.push(p), s[f][c] = p, l[f]++;
          }
        };
      }
    }, r.prototype._updateScale = function(t, e) {
      T(this._axesList, function(n) {
        if (n.scale.setExtent(1 / 0, -1 / 0), n.type === "category") {
          var a = n.model.get("categorySortInfo");
          n.scale.setSortInfo(a);
        }
      }), t.eachSeries(function(n) {
        if (gd(n)) {
          var a = yd(n), o = a.xAxisModel, s = a.yAxisModel;
          if (!pu(o, e) || !pu(s, e))
            return;
          var l = this.getCartesian(o.componentIndex, s.componentIndex), u = n.getData(), f = l.getAxis("x"), h = l.getAxis("y");
          i(u, f), i(u, h);
        }
      }, this);
      function i(n, a) {
        T(lD(n, a.dim), function(o) {
          a.scale.unionExtentFromData(n, o);
        });
      }
    }, r.prototype.getTooltipAxes = function(t) {
      var e = [], i = [];
      return T(this.getCartesians(), function(n) {
        var a = t != null && t !== "auto" ? n.getAxis(t) : n.getBaseAxis(), o = n.getOtherAxis(a);
        nt(e, a) < 0 && e.push(a), nt(i, o) < 0 && i.push(o);
      }), {
        baseAxes: e,
        otherAxes: i
      };
    }, r.create = function(t, e) {
      var i = [];
      return t.eachComponent("grid", function(n, a) {
        var o = new r(n, t, e);
        o.name = "grid_" + a, o.resize(n, e, !0), n.coordinateSystem = o, i.push(o);
      }), t.eachSeries(function(n) {
        if (gd(n)) {
          var a = yd(n), o = a.xAxisModel, s = a.yAxisModel, l = o.getCoordSysModel(), u = l.coordinateSystem;
          n.coordinateSystem = u.getCartesian(o.componentIndex, s.componentIndex);
        }
      }), i;
    }, r.dimensions = Ef, r;
  })()
);
function pu(r, t) {
  return r.getCoordSysModel() === t;
}
function md(r, t, e, i) {
  e.getAxesOnZeroOf = function() {
    return a ? [a] : [];
  };
  var n = r[t], a, o = e.model, s = o.get(["axisLine", "onZero"]), l = o.get(["axisLine", "onZeroAxisIndex"]);
  if (!s)
    return;
  if (l != null)
    _d(n[l]) && (a = n[l]);
  else
    for (var u in n)
      if (n.hasOwnProperty(u) && _d(n[u]) && !i[f(n[u])]) {
        a = n[u];
        break;
      }
  a && (i[f(a)] = !0);
  function f(h) {
    return h.dim + "_" + h.index;
  }
}
function _d(r) {
  return r && r.type !== "category" && r.type !== "time" && aD(r);
}
function HA(r, t) {
  var e = r.getExtent(), i = e[0] + e[1];
  r.toGlobalCoord = r.dim === "x" ? function(n) {
    return n + t;
  } : function(n) {
    return i - n + t;
  }, r.toLocalCoord = r.dim === "x" ? function(n) {
    return n - t;
  } : function(n) {
    return i - n + t;
  };
}
var _r = Math.PI, Tr = (
  /** @class */
  (function() {
    function r(t, e) {
      this.group = new gt(), this.opt = e, this.axisModel = t, at(e, {
        labelOffset: 0,
        nameDirection: 1,
        tickDirection: 1,
        labelDirection: 1,
        silent: !0,
        handleAutoShown: function() {
          return !0;
        }
      });
      var i = new gt({
        x: e.position[0],
        y: e.position[1],
        rotation: e.rotation
      });
      i.updateTransform(), this._transformGroup = i;
    }
    return r.prototype.hasBuilder = function(t) {
      return !!Sd[t];
    }, r.prototype.add = function(t) {
      Sd[t](this.opt, this.axisModel, this.group, this._transformGroup);
    }, r.prototype.getGroup = function() {
      return this.group;
    }, r.innerTextLayout = function(t, e, i) {
      var n = uh(e - t), a, o;
      return ia(n) ? (o = i > 0 ? "top" : "bottom", a = "center") : ia(n - _r) ? (o = i > 0 ? "bottom" : "top", a = "center") : (o = "middle", n > 0 && n < _r ? a = i > 0 ? "right" : "left" : a = i > 0 ? "left" : "right"), {
        rotation: n,
        textAlign: a,
        textVerticalAlign: o
      };
    }, r.makeAxisEventDataBase = function(t) {
      var e = {
        componentType: t.mainType,
        componentIndex: t.componentIndex
      };
      return e[t.mainType + "Index"] = t.componentIndex, e;
    }, r.isLabelSilent = function(t) {
      var e = t.get("tooltip");
      return t.get("silent") || !(t.get("triggerEvent") || e && e.show);
    }, r;
  })()
), Sd = {
  axisLine: function(r, t, e, i) {
    var n = t.get(["axisLine", "show"]);
    if (n === "auto" && r.handleAutoShown && (n = r.handleAutoShown("axisLine")), !!n) {
      var a = t.axis.getExtent(), o = i.transform, s = [a[0], 0], l = [a[1], 0], u = s[0] > l[0];
      o && (Vt(s, s, o), Vt(l, l, o));
      var f = k({
        lineCap: "round"
      }, t.getModel(["axisLine", "lineStyle"]).getLineStyle()), h = new Xe({
        shape: {
          x1: s[0],
          y1: s[1],
          x2: l[0],
          y2: l[1]
        },
        style: f,
        strokeContainThreshold: r.strokeContainThreshold || 5,
        silent: !0,
        z2: 1
      });
      ua(h.shape, h.style.lineWidth), h.anid = "line", e.add(h);
      var c = t.get(["axisLine", "symbol"]);
      if (c != null) {
        var v = t.get(["axisLine", "symbolSize"]);
        V(c) && (c = [c, c]), (V(v) || vt(v)) && (v = [v, v]);
        var p = Ks(t.get(["axisLine", "symbolOffset"]) || 0, v), g = v[0], d = v[1];
        T([{
          rotate: r.rotation + Math.PI / 2,
          offset: p[0],
          r: 0
        }, {
          rotate: r.rotation - Math.PI / 2,
          offset: p[1],
          r: Math.sqrt((s[0] - l[0]) * (s[0] - l[0]) + (s[1] - l[1]) * (s[1] - l[1]))
        }], function(y, m) {
          if (c[m] !== "none" && c[m] != null) {
            var _ = ge(c[m], -g / 2, -d / 2, g, d, f.stroke, !0), S = y.r + y.offset, w = u ? l : s;
            _.attr({
              rotation: y.rotate,
              x: w[0] + S * Math.cos(r.rotation),
              y: w[1] - S * Math.sin(r.rotation),
              silent: !0,
              z2: 11
            }), e.add(_);
          }
        });
      }
    }
  },
  axisTickLabel: function(r, t, e, i) {
    var n = UA(e, i, t, r), a = XA(e, i, t, r);
    if (WA(t, a, n), YA(e, i, t, r.tickDirection), t.get(["axisLabel", "hideOverlap"])) {
      var o = FD(z(a, function(s) {
        return {
          label: s,
          priority: s.z2,
          defaultAttr: {
            ignore: s.ignore
          }
        };
      }));
      VD(o);
    }
  },
  axisName: function(r, t, e, i) {
    var n = Cr(r.axisName, t.get("name"));
    if (n) {
      var a = t.get("nameLocation"), o = r.nameDirection, s = t.getModel("nameTextStyle"), l = t.get("nameGap") || 0, u = t.axis.getExtent(), f = u[0] > u[1] ? -1 : 1, h = [
        a === "start" ? u[0] - f * l : a === "end" ? u[1] + f * l : (u[0] + u[1]) / 2,
        // Reuse labelOffset.
        wd(a) ? r.labelOffset + o * l : 0
      ], c, v = t.get("nameRotate");
      v != null && (v = v * _r / 180);
      var p;
      wd(a) ? c = Tr.innerTextLayout(
        r.rotation,
        v ?? r.rotation,
        // Adapt to axis.
        o
      ) : (c = GA(r.rotation, a, v || 0, u), p = r.axisNameAvailableWidth, p != null && (p = Math.abs(p / Math.sin(c.rotation)), !isFinite(p) && (p = null)));
      var g = s.getFont(), d = t.get("nameTruncate", !0) || {}, y = d.ellipsis, m = Cr(r.nameTruncateMaxWidth, d.maxWidth, p), _ = new mt({
        x: h[0],
        y: h[1],
        rotation: c.rotation,
        silent: Tr.isLabelSilent(t),
        style: re(s, {
          text: n,
          font: g,
          overflow: "truncate",
          width: m,
          ellipsis: y,
          fill: s.getTextColor() || t.get(["axisLine", "lineStyle", "color"]),
          align: s.get("align") || c.textAlign,
          verticalAlign: s.get("verticalAlign") || c.textVerticalAlign
        }),
        z2: 1
      });
      if (Bs({
        el: _,
        componentModel: t,
        itemName: n
      }), _.__fullText = n, _.anid = "name", t.get("triggerEvent")) {
        var S = Tr.makeAxisEventDataBase(t);
        S.targetType = "axisName", S.name = n, J(_).eventData = S;
      }
      i.add(_), _.updateTransform(), e.add(_), _.decomposeTransform();
    }
  }
};
function GA(r, t, e, i) {
  var n = uh(e - r), a, o, s = i[0] > i[1], l = t === "start" && !s || t !== "start" && s;
  return ia(n - _r / 2) ? (o = l ? "bottom" : "top", a = "center") : ia(n - _r * 1.5) ? (o = l ? "top" : "bottom", a = "center") : (o = "middle", n < _r * 1.5 && n > _r / 2 ? a = l ? "left" : "right" : a = l ? "right" : "left"), {
    rotation: n,
    textAlign: a,
    textVerticalAlign: o
  };
}
function WA(r, t, e) {
  if (!P0(r.axis)) {
    var i = r.get(["axisLabel", "showMinLabel"]), n = r.get(["axisLabel", "showMaxLabel"]);
    t = t || [], e = e || [];
    var a = t[0], o = t[1], s = t[t.length - 1], l = t[t.length - 2], u = e[0], f = e[1], h = e[e.length - 1], c = e[e.length - 2];
    i === !1 ? (ae(a), ae(u)) : bd(a, o) && (i ? (ae(o), ae(f)) : (ae(a), ae(u))), n === !1 ? (ae(s), ae(h)) : bd(l, s) && (n ? (ae(l), ae(c)) : (ae(s), ae(h)));
  }
}
function ae(r) {
  r && (r.ignore = !0);
}
function bd(r, t) {
  var e = r && r.getBoundingRect().clone(), i = t && t.getBoundingRect().clone();
  if (!(!e || !i)) {
    var n = ba([]);
    return ws(n, n, -r.rotation), e.applyTransform(br([], n, r.getLocalTransform())), i.applyTransform(br([], n, t.getLocalTransform())), e.intersect(i);
  }
}
function wd(r) {
  return r === "middle" || r === "center";
}
function r_(r, t, e, i, n) {
  for (var a = [], o = [], s = [], l = 0; l < r.length; l++) {
    var u = r[l].coord;
    o[0] = u, o[1] = 0, s[0] = u, s[1] = e, t && (Vt(o, o, t), Vt(s, s, t));
    var f = new Xe({
      shape: {
        x1: o[0],
        y1: o[1],
        x2: s[0],
        y2: s[1]
      },
      style: i,
      z2: 2,
      autoBatch: !0,
      silent: !0
    });
    ua(f.shape, f.style.lineWidth), f.anid = n + "_" + r[l].tickValue, a.push(f);
  }
  return a;
}
function UA(r, t, e, i) {
  var n = e.axis, a = e.getModel("axisTick"), o = a.get("show");
  if (o === "auto" && i.handleAutoShown && (o = i.handleAutoShown("axisTick")), !(!o || n.scale.isBlank())) {
    for (var s = a.getModel("lineStyle"), l = i.tickDirection * a.get("length"), u = n.getTicksCoords(), f = r_(u, t.transform, l, at(s.getLineStyle(), {
      stroke: e.get(["axisLine", "lineStyle", "color"])
    }), "ticks"), h = 0; h < f.length; h++)
      r.add(f[h]);
    return f;
  }
}
function YA(r, t, e, i) {
  var n = e.axis, a = e.getModel("minorTick");
  if (!(!a.get("show") || n.scale.isBlank())) {
    var o = n.getMinorTicksCoords();
    if (o.length)
      for (var s = a.getModel("lineStyle"), l = i * a.get("length"), u = at(s.getLineStyle(), at(e.getModel("axisTick").getLineStyle(), {
        stroke: e.get(["axisLine", "lineStyle", "color"])
      })), f = 0; f < o.length; f++)
        for (var h = r_(o[f], t.transform, l, u, "minorticks_" + f), c = 0; c < h.length; c++)
          r.add(h[c]);
  }
}
function XA(r, t, e, i) {
  var n = e.axis, a = Cr(i.axisLabelShow, e.get(["axisLabel", "show"]));
  if (!(!a || n.scale.isBlank())) {
    var o = e.getModel("axisLabel"), s = o.get("margin"), l = n.getViewLabels(), u = (Cr(i.labelRotate, o.get("rotate")) || 0) * _r / 180, f = Tr.innerTextLayout(i.rotation, u, i.labelDirection), h = e.getCategories && e.getCategories(!0), c = [], v = Tr.isLabelSilent(e), p = e.get("triggerEvent");
    return T(l, function(g, d) {
      var y = n.scale.type === "ordinal" ? n.scale.getRawOrdinalNumber(g.tickValue) : g.tickValue, m = g.formattedLabel, _ = g.rawLabel, S = o;
      if (h && h[y]) {
        var w = h[y];
        H(w) && w.textStyle && (S = new pt(w.textStyle, o, e.ecModel));
      }
      var b = S.getTextColor() || e.get(["axisLine", "lineStyle", "color"]), x = n.dataToCoord(y), M = S.getShallow("align", !0) || f.textAlign, D = Z(S.getShallow("alignMinLabel", !0), M), A = Z(S.getShallow("alignMaxLabel", !0), M), C = S.getShallow("verticalAlign", !0) || S.getShallow("baseline", !0) || f.textVerticalAlign, I = Z(S.getShallow("verticalAlignMinLabel", !0), C), L = Z(S.getShallow("verticalAlignMaxLabel", !0), C), P = new mt({
        x,
        y: i.labelOffset + i.labelDirection * s,
        rotation: f.rotation,
        silent: v,
        z2: 10 + (g.level || 0),
        style: re(S, {
          text: m,
          align: d === 0 ? D : d === l.length - 1 ? A : M,
          verticalAlign: d === 0 ? I : d === l.length - 1 ? L : C,
          fill: X(b) ? b(
            // (1) In category axis with data zoom, tick is not the original
            // index of axis.data. So tick should not be exposed to user
            // in category axis.
            // (2) Compatible with previous version, which always use formatted label as
            // input. But in interval scale the formatted label is like '223,445', which
            // maked user replace ','. So we modify it to return original val but remain
            // it as 'string' to avoid error in replacing.
            n.type === "category" ? _ : n.type === "value" ? y + "" : y,
            d
          ) : b
        })
      });
      if (P.anid = "label_" + y, Bs({
        el: P,
        componentModel: e,
        itemName: m,
        formatterParamsExtra: {
          isTruncated: function() {
            return P.isTruncated;
          },
          value: _,
          tickIndex: d
        }
      }), p) {
        var R = Tr.makeAxisEventDataBase(e);
        R.targetType = "axisLabel", R.value = _, R.tickIndex = d, n.type === "category" && (R.dataIndex = y), J(P).eventData = R;
      }
      t.add(P), P.updateTransform(), c.push(P), r.add(P), P.decomposeTransform();
    }), c;
  }
}
function $A(r, t) {
  var e = {
    /**
     * key: makeKey(axis.model)
     * value: {
     *      axis,
     *      coordSys,
     *      axisPointerModel,
     *      triggerTooltip,
     *      triggerEmphasis,
     *      involveSeries,
     *      snap,
     *      seriesModels,
     *      seriesDataCount
     * }
     */
    axesInfo: {},
    seriesInvolved: !1,
    /**
     * key: makeKey(coordSys.model)
     * value: Object: key makeKey(axis.model), value: axisInfo
     */
    coordSysAxesInfo: {},
    coordSysMap: {}
  };
  return ZA(e, r, t), e.seriesInvolved && KA(e, r), e;
}
function ZA(r, t, e) {
  var i = t.getComponent("tooltip"), n = t.getComponent("axisPointer"), a = n.get("link", !0) || [], o = [];
  T(e.getCoordinateSystems(), function(s) {
    if (!s.axisPointerEnabled)
      return;
    var l = ga(s.model), u = r.coordSysAxesInfo[l] = {};
    r.coordSysMap[l] = s;
    var f = s.model, h = f.getModel("tooltip", i);
    if (T(s.getAxes(), ht(g, !1, null)), s.getTooltipAxes && i && h.get("show")) {
      var c = h.get("trigger") === "axis", v = h.get(["axisPointer", "type"]) === "cross", p = s.getTooltipAxes(h.get(["axisPointer", "axis"]));
      (c || v) && T(p.baseAxes, ht(g, v ? "cross" : !0, c)), v && T(p.otherAxes, ht(g, "cross", !1));
    }
    function g(d, y, m) {
      var _ = m.model.getModel("axisPointer", n), S = _.get("show");
      if (!(!S || S === "auto" && !d && !kf(_))) {
        y == null && (y = _.get("triggerTooltip")), _ = d ? qA(m, h, n, t, d, y) : _;
        var w = _.get("snap"), b = _.get("triggerEmphasis"), x = ga(m.model), M = y || w || m.type === "category", D = r.axesInfo[x] = {
          key: x,
          axis: m,
          coordSys: s,
          axisPointerModel: _,
          triggerTooltip: y,
          triggerEmphasis: b,
          involveSeries: M,
          snap: w,
          useHandle: kf(_),
          seriesModels: [],
          linkGroup: null
        };
        u[x] = D, r.seriesInvolved = r.seriesInvolved || M;
        var A = QA(a, m);
        if (A != null) {
          var C = o[A] || (o[A] = {
            axesInfo: {}
          });
          C.axesInfo[x] = D, C.mapper = a[A].mapper, D.linkGroup = C;
        }
      }
    }
  });
}
function qA(r, t, e, i, n, a) {
  var o = t.getModel("axisPointer"), s = ["type", "snap", "lineStyle", "shadowStyle", "label", "animation", "animationDurationUpdate", "animationEasingUpdate", "z"], l = {};
  T(s, function(c) {
    l[c] = U(o.get(c));
  }), l.snap = r.type !== "category" && !!a, o.get("type") === "cross" && (l.type = "line");
  var u = l.label || (l.label = {});
  if (u.show == null && (u.show = !1), n === "cross") {
    var f = o.get(["label", "show"]);
    if (u.show = f ?? !0, !a) {
      var h = l.lineStyle = o.get("crossStyle");
      h && at(u, h.textStyle);
    }
  }
  return r.model.getModel("axisPointer", new pt(l, e, i));
}
function KA(r, t) {
  t.eachSeries(function(e) {
    var i = e.coordinateSystem, n = e.get(["tooltip", "trigger"], !0), a = e.get(["tooltip", "show"], !0);
    !i || n === "none" || n === !1 || n === "item" || a === !1 || e.get(["axisPointer", "show"], !0) === !1 || T(r.coordSysAxesInfo[ga(i.model)], function(o) {
      var s = o.axis;
      i.getAxis(s.dim) === s && (o.seriesModels.push(e), o.seriesDataCount == null && (o.seriesDataCount = 0), o.seriesDataCount += e.getData().count());
    });
  });
}
function QA(r, t) {
  for (var e = t.model, i = t.dim, n = 0; n < r.length; n++) {
    var a = r[n] || {};
    if (du(a[i + "AxisId"], e.id) || du(a[i + "AxisIndex"], e.componentIndex) || du(a[i + "AxisName"], e.name))
      return n;
  }
}
function du(r, t) {
  return r === "all" || O(r) && nt(r, t) >= 0 || r === t;
}
function JA(r) {
  var t = sv(r);
  if (t) {
    var e = t.axisPointerModel, i = t.axis.scale, n = e.option, a = e.get("status"), o = e.get("value");
    o != null && (o = i.parse(o));
    var s = kf(e);
    a == null && (n.status = s ? "show" : "hide");
    var l = i.getExtent().slice();
    l[0] > l[1] && l.reverse(), // Pick a value on axis when initializing.
    (o == null || o > l[1]) && (o = l[1]), o < l[0] && (o = l[0]), n.value = o, s && (n.status = t.axis.scale.isBlank() ? "hide" : "show");
  }
}
function sv(r) {
  var t = (r.ecModel.getComponent("axisPointer") || {}).coordSysAxesInfo;
  return t && t.axesInfo[ga(r)];
}
function jA(r) {
  var t = sv(r);
  return t && t.axisPointerModel;
}
function kf(r) {
  return !!r.get(["handle", "show"]);
}
function ga(r) {
  return r.type + "||" + r.id;
}
var xd = {}, i_ = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e;
    }
    return t.prototype.render = function(e, i, n, a) {
      this.axisPointerClass && JA(e), r.prototype.render.apply(this, arguments), this._doUpdateAxisPointerClass(e, n, !0);
    }, t.prototype.updateAxisPointer = function(e, i, n, a) {
      this._doUpdateAxisPointerClass(e, n, !1);
    }, t.prototype.remove = function(e, i) {
      var n = this._axisPointer;
      n && n.remove(i);
    }, t.prototype.dispose = function(e, i) {
      this._disposeAxisPointer(i), r.prototype.dispose.apply(this, arguments);
    }, t.prototype._doUpdateAxisPointerClass = function(e, i, n) {
      var a = t.getAxisPointerClass(this.axisPointerClass);
      if (a) {
        var o = jA(e);
        o ? (this._axisPointer || (this._axisPointer = new a())).render(e, o, i, n) : this._disposeAxisPointer(i);
      }
    }, t.prototype._disposeAxisPointer = function(e) {
      this._axisPointer && this._axisPointer.dispose(e), this._axisPointer = null;
    }, t.registerAxisPointerClass = function(e, i) {
      xd[e] = i;
    }, t.getAxisPointerClass = function(e) {
      return e && xd[e];
    }, t.type = "axis", t;
  })(kt)
), Nf = bt();
function tI(r, t, e, i) {
  var n = e.axis;
  if (!n.scale.isBlank()) {
    var a = e.getModel("splitArea"), o = a.getModel("areaStyle"), s = o.get("color"), l = i.coordinateSystem.getRect(), u = n.getTicksCoords({
      tickModel: a,
      clamp: !0
    });
    if (u.length) {
      var f = s.length, h = Nf(r).splitAreaColors, c = q(), v = 0;
      if (h)
        for (var p = 0; p < u.length; p++) {
          var g = h.get(u[p].tickValue);
          if (g != null) {
            v = (g + (f - 1) * p) % f;
            break;
          }
        }
      var d = n.toGlobalCoord(u[0].coord), y = o.getAreaStyle();
      s = O(s) ? s : [s];
      for (var p = 1; p < u.length; p++) {
        var m = n.toGlobalCoord(u[p].coord), _ = void 0, S = void 0, w = void 0, b = void 0;
        n.isHorizontal() ? (_ = d, S = l.y, w = m - _, b = l.height, d = _ + w) : (_ = l.x, S = d, w = l.width, b = m - S, d = S + b);
        var x = u[p - 1].tickValue;
        x != null && c.set(x, v), t.add(new dt({
          anid: x != null ? "area_" + x : null,
          shape: {
            x: _,
            y: S,
            width: w,
            height: b
          },
          style: at({
            fill: s[v]
          }, y),
          autoBatch: !0,
          silent: !0
        })), v = (v + 1) % f;
      }
      Nf(r).splitAreaColors = c;
    }
  }
}
function eI(r) {
  Nf(r).splitAreaColors = null;
}
var rI = ["axisLine", "axisTickLabel", "axisName"], iI = ["splitArea", "splitLine", "minorSplitLine"], n_ = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e.axisPointerClass = "CartesianAxisPointer", e;
    }
    return t.prototype.render = function(e, i, n, a) {
      this.group.removeAll();
      var o = this._axisGroup;
      if (this._axisGroup = new gt(), this.group.add(this._axisGroup), !!e.get("show")) {
        var s = e.getCoordSysModel(), l = Of(s, e), u = new Tr(e, k({
          handleAutoShown: function(h) {
            for (var c = s.coordinateSystem.getCartesians(), v = 0; v < c.length; v++)
              if (Af(c[v].getOtherAxis(e.axis).scale))
                return !0;
            return !1;
          }
        }, l));
        T(rI, u.add, u), this._axisGroup.add(u.getGroup()), T(iI, function(h) {
          e.get([h, "show"]) && nI[h](this, this._axisGroup, e, s);
        }, this);
        var f = a && a.type === "changeAxisOrder" && a.isInitSort;
        f || Wy(o, this._axisGroup, e), r.prototype.render.call(this, e, i, n, a);
      }
    }, t.prototype.remove = function() {
      eI(this);
    }, t.type = "cartesianAxis", t;
  })(i_)
), nI = {
  splitLine: function(r, t, e, i) {
    var n = e.axis;
    if (!n.scale.isBlank()) {
      var a = e.getModel("splitLine"), o = a.getModel("lineStyle"), s = o.get("color"), l = a.get("showMinLine") !== !1, u = a.get("showMaxLine") !== !1;
      s = O(s) ? s : [s];
      for (var f = i.coordinateSystem.getRect(), h = n.isHorizontal(), c = 0, v = n.getTicksCoords({
        tickModel: a
      }), p = [], g = [], d = o.getLineStyle(), y = 0; y < v.length; y++) {
        var m = n.toGlobalCoord(v[y].coord);
        if (!(y === 0 && !l || y === v.length - 1 && !u)) {
          var _ = v[y].tickValue;
          h ? (p[0] = m, p[1] = f.y, g[0] = m, g[1] = f.y + f.height) : (p[0] = f.x, p[1] = m, g[0] = f.x + f.width, g[1] = m);
          var S = c++ % s.length, w = new Xe({
            anid: _ != null ? "line_" + _ : null,
            autoBatch: !0,
            shape: {
              x1: p[0],
              y1: p[1],
              x2: g[0],
              y2: g[1]
            },
            style: at({
              stroke: s[S]
            }, d),
            silent: !0
          });
          ua(w.shape, d.lineWidth), t.add(w);
        }
      }
    }
  },
  minorSplitLine: function(r, t, e, i) {
    var n = e.axis, a = e.getModel("minorSplitLine"), o = a.getModel("lineStyle"), s = i.coordinateSystem.getRect(), l = n.isHorizontal(), u = n.getMinorTicksCoords();
    if (u.length)
      for (var f = [], h = [], c = o.getLineStyle(), v = 0; v < u.length; v++)
        for (var p = 0; p < u[v].length; p++) {
          var g = n.toGlobalCoord(u[v][p].coord);
          l ? (f[0] = g, f[1] = s.y, h[0] = g, h[1] = s.y + s.height) : (f[0] = s.x, f[1] = g, h[0] = s.x + s.width, h[1] = g);
          var d = new Xe({
            anid: "minor_line_" + u[v][p].tickValue,
            autoBatch: !0,
            shape: {
              x1: f[0],
              y1: f[1],
              x2: h[0],
              y2: h[1]
            },
            style: c,
            silent: !0
          });
          ua(d.shape, c.lineWidth), t.add(d);
        }
  },
  splitArea: function(r, t, e, i) {
    tI(r, t, e, i);
  }
}, a_ = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e;
    }
    return t.type = "xAxis", t;
  })(n_)
), aI = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = a_.type, e;
    }
    return t.type = "yAxis", t;
  })(n_)
), oI = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = "grid", e;
    }
    return t.prototype.render = function(e, i) {
      this.group.removeAll(), e.get("show") && this.group.add(new dt({
        shape: e.coordinateSystem.getRect(),
        style: at({
          fill: e.get("backgroundColor")
        }, e.getItemStyle()),
        silent: !0,
        z2: -1
      }));
    }, t.type = "grid", t;
  })(kt)
), Td = {
  // gridIndex: 0,
  // gridId: '',
  offset: 0
};
function o_(r) {
  r.registerComponentView(oI), r.registerComponentModel(LA), r.registerCoordinateSystem("cartesian2d", VA), cd(r, "x", Rf, Td), cd(r, "y", Rf, Td), r.registerComponentView(a_), r.registerComponentView(aI), r.registerPreprocessor(function(t) {
    t.xAxis && t.yAxis && !t.grid && (t.grid = {});
  });
}
function sI(r) {
  ye(o_), r.registerSeriesModel(CA), r.registerChartView(IA), r.registerLayout(av("scatter"));
}
var ya = T, lI = H, ps = -1, Ot = (
  /** @class */
  (function() {
    function r(t) {
      var e = t.mappingMethod, i = t.type, n = this.option = U(t);
      this.type = i, this.mappingMethod = e, this._normalizeData = hI[e];
      var a = r.visualHandlers[i];
      this.applyVisual = a.applyVisual, this.getColorMapper = a.getColorMapper, this._normalizedToVisual = a._normalizedToVisual[e], e === "piecewise" ? (gu(n), uI(n)) : e === "category" ? n.categories ? fI(n) : gu(n, !0) : (Ee(e !== "linear" || n.dataExtent), gu(n));
    }
    return r.prototype.mapValueToVisual = function(t) {
      var e = this._normalizeData(t);
      return this._normalizedToVisual(e, t);
    }, r.prototype.getNormalizer = function() {
      return Q(this._normalizeData, this);
    }, r.listVisualTypes = function() {
      return ct(r.visualHandlers);
    }, r.isValidType = function(t) {
      return r.visualHandlers.hasOwnProperty(t);
    }, r.eachVisual = function(t, e, i) {
      H(t) ? T(t, e, i) : e.call(i, t);
    }, r.mapVisual = function(t, e, i) {
      var n, a = O(t) ? [] : H(t) ? {} : (n = !0, null);
      return r.eachVisual(t, function(o, s) {
        var l = e.call(i, o, s);
        n ? a = l : a[s] = l;
      }), a;
    }, r.retrieveVisuals = function(t) {
      var e = {}, i;
      return t && ya(r.visualHandlers, function(n, a) {
        t.hasOwnProperty(a) && (e[a] = t[a], i = !0);
      }), i ? e : null;
    }, r.prepareVisualTypes = function(t) {
      if (O(t))
        t = t.slice();
      else if (lI(t)) {
        var e = [];
        ya(t, function(i, n) {
          e.push(n);
        }), t = e;
      } else
        return [];
      return t.sort(function(i, n) {
        return n === "color" && i !== "color" && i.indexOf("color") === 0 ? 1 : -1;
      }), t;
    }, r.dependsOn = function(t, e) {
      return e === "color" ? !!(t && t.indexOf(e) === 0) : t === e;
    }, r.findPieceIndex = function(t, e, i) {
      for (var n, a = 1 / 0, o = 0, s = e.length; o < s; o++) {
        var l = e[o].value;
        if (l != null) {
          if (l === t || V(l) && l === t + "")
            return o;
          i && c(l, o);
        }
      }
      for (var o = 0, s = e.length; o < s; o++) {
        var u = e[o], f = u.interval, h = u.close;
        if (f) {
          if (f[0] === -1 / 0) {
            if (So(h[1], t, f[1]))
              return o;
          } else if (f[1] === 1 / 0) {
            if (So(h[0], f[0], t))
              return o;
          } else if (So(h[0], f[0], t) && So(h[1], t, f[1]))
            return o;
          i && c(f[0], o), i && c(f[1], o);
        }
      }
      if (i)
        return t === 1 / 0 ? e.length - 1 : t === -1 / 0 ? 0 : n;
      function c(v, p) {
        var g = Math.abs(v - t);
        g < a && (a = g, n = p);
      }
    }, r.visualHandlers = {
      color: {
        applyVisual: An("color"),
        getColorMapper: function() {
          var t = this.option;
          return Q(t.mappingMethod === "category" ? function(e, i) {
            return !i && (e = this._normalizeData(e)), Bn.call(this, e);
          } : function(e, i, n) {
            var a = !!n;
            return !i && (e = this._normalizeData(e)), n = Vn(e, t.parsedVisual, n), a ? n : Le(n, "rgba");
          }, this);
        },
        _normalizedToVisual: {
          linear: function(t) {
            return Le(Vn(t, this.option.parsedVisual), "rgba");
          },
          category: Bn,
          piecewise: function(t, e) {
            var i = zf.call(this, e);
            return i == null && (i = Le(Vn(t, this.option.parsedVisual), "rgba")), i;
          },
          fixed: ti
        }
      },
      colorHue: _o(function(t, e) {
        return Io(t, e);
      }),
      colorSaturation: _o(function(t, e) {
        return Io(t, null, e);
      }),
      colorLightness: _o(function(t, e) {
        return Io(t, null, null, e);
      }),
      colorAlpha: _o(function(t, e) {
        return Ug(t, e);
      }),
      decal: {
        applyVisual: An("decal"),
        _normalizedToVisual: {
          linear: null,
          category: Bn,
          piecewise: null,
          fixed: null
        }
      },
      opacity: {
        applyVisual: An("opacity"),
        _normalizedToVisual: Bf([0, 1])
      },
      liftZ: {
        applyVisual: An("liftZ"),
        _normalizedToVisual: {
          linear: ti,
          category: ti,
          piecewise: ti,
          fixed: ti
        }
      },
      symbol: {
        applyVisual: function(t, e, i) {
          var n = this.mapValueToVisual(t);
          i("symbol", n);
        },
        _normalizedToVisual: {
          linear: Cd,
          category: Bn,
          piecewise: function(t, e) {
            var i = zf.call(this, e);
            return i == null && (i = Cd.call(this, t)), i;
          },
          fixed: ti
        }
      },
      symbolSize: {
        applyVisual: An("symbolSize"),
        _normalizedToVisual: Bf([0, 1])
      }
    }, r;
  })()
);
function uI(r) {
  var t = r.pieceList;
  r.hasSpecialVisual = !1, T(t, function(e, i) {
    e.originIndex = i, e.visual != null && (r.hasSpecialVisual = !0);
  });
}
function fI(r) {
  var t = r.categories, e = r.categoryMap = {}, i = r.visual;
  if (ya(t, function(o, s) {
    e[o] = s;
  }), !O(i)) {
    var n = [];
    H(i) ? ya(i, function(o, s) {
      var l = e[s];
      n[l ?? ps] = o;
    }) : n[ps] = i, i = s_(r, n);
  }
  for (var a = t.length - 1; a >= 0; a--)
    i[a] == null && (delete e[t[a]], t.pop());
}
function gu(r, t) {
  var e = r.visual, i = [];
  H(e) ? ya(e, function(a) {
    i.push(a);
  }) : e != null && i.push(e);
  var n = {
    color: 1,
    symbol: 1
  };
  !t && i.length === 1 && !n.hasOwnProperty(r.type) && (i[1] = i[0]), s_(r, i);
}
function _o(r) {
  return {
    applyVisual: function(t, e, i) {
      var n = this.mapValueToVisual(t);
      i("color", r(e("color"), n));
    },
    _normalizedToVisual: Bf([0, 1])
  };
}
function Cd(r) {
  var t = this.option.visual;
  return t[Math.round(Ye(r, [0, 1], [0, t.length - 1], !0))] || {};
}
function An(r) {
  return function(t, e, i) {
    i(r, this.mapValueToVisual(t));
  };
}
function Bn(r) {
  var t = this.option.visual;
  return t[this.option.loop && r !== ps ? r % t.length : r];
}
function ti() {
  return this.option.visual[0];
}
function Bf(r) {
  return {
    linear: function(t) {
      return Ye(t, r, this.option.visual, !0);
    },
    category: Bn,
    piecewise: function(t, e) {
      var i = zf.call(this, e);
      return i == null && (i = Ye(t, r, this.option.visual, !0)), i;
    },
    fixed: ti
  };
}
function zf(r) {
  var t = this.option, e = t.pieceList;
  if (t.hasSpecialVisual) {
    var i = Ot.findPieceIndex(r, e), n = e[i];
    if (n && n.visual)
      return n.visual[this.type];
  }
}
function s_(r, t) {
  return r.visual = t, r.type === "color" && (r.parsedVisual = z(t, function(e) {
    var i = Kt(e);
    return i || [0, 0, 0, 1];
  })), t;
}
var hI = {
  linear: function(r) {
    return Ye(r, this.option.dataExtent, [0, 1], !0);
  },
  piecewise: function(r) {
    var t = this.option.pieceList, e = Ot.findPieceIndex(r, t, !0);
    if (e != null)
      return Ye(e, [0, t.length - 1], [0, 1], !0);
  },
  category: function(r) {
    var t = this.option.categories ? this.option.categoryMap[r] : r;
    return t ?? ps;
  },
  fixed: Rt
};
function So(r, t, e) {
  return r ? t <= e : t < e;
}
var Md = Xe.prototype, yu = Ia.prototype, l_ = (
  /** @class */
  /* @__PURE__ */ (function() {
    function r() {
      this.x1 = 0, this.y1 = 0, this.x2 = 0, this.y2 = 0, this.percent = 1;
    }
    return r;
  })()
);
(function(r) {
  F(t, r);
  function t() {
    return r !== null && r.apply(this, arguments) || this;
  }
  return t;
})(l_);
function mu(r) {
  return isNaN(+r.cpx1) || isNaN(+r.cpy1);
}
var vI = (
  /** @class */
  (function(r) {
    F(t, r);
    function t(e) {
      var i = r.call(this, e) || this;
      return i.type = "ec-line", i;
    }
    return t.prototype.getDefaultStyle = function() {
      return {
        stroke: "#000",
        fill: null
      };
    }, t.prototype.getDefaultShape = function() {
      return new l_();
    }, t.prototype.buildPath = function(e, i) {
      mu(i) ? Md.buildPath.call(this, e, i) : yu.buildPath.call(this, e, i);
    }, t.prototype.pointAt = function(e) {
      return mu(this.shape) ? Md.pointAt.call(this, e) : yu.pointAt.call(this, e);
    }, t.prototype.tangentAt = function(e) {
      var i = this.shape, n = mu(i) ? [i.x2 - i.x1, i.y2 - i.y1] : yu.tangentAt.call(this, e);
      return bs(n, n);
    }, t;
  })(ot)
), _u = ["fromSymbol", "toSymbol"];
function Dd(r) {
  return "_" + r + "Type";
}
function Ad(r, t, e) {
  var i = t.getItemVisual(e, r);
  if (!i || i === "none")
    return i;
  var n = t.getItemVisual(e, r + "Size"), a = t.getItemVisual(e, r + "Rotate"), o = t.getItemVisual(e, r + "Offset"), s = t.getItemVisual(e, r + "KeepAspect"), l = Hh(n), u = Ks(o || 0, l);
  return i + l + u + (a || "") + (s || "");
}
function Id(r, t, e) {
  var i = t.getItemVisual(e, r);
  if (!(!i || i === "none")) {
    var n = t.getItemVisual(e, r + "Size"), a = t.getItemVisual(e, r + "Rotate"), o = t.getItemVisual(e, r + "Offset"), s = t.getItemVisual(e, r + "KeepAspect"), l = Hh(n), u = Ks(o || 0, l), f = ge(i, -l[0] / 2 + u[0], -l[1] / 2 + u[1], l[0], l[1], null, s);
    return f.__specifiedRotation = a == null || isNaN(a) ? void 0 : +a * Math.PI / 180 || 0, f.name = r, f;
  }
}
function cI(r) {
  var t = new vI({
    name: "line",
    subPixelOptimize: !0
  });
  return Ff(t.shape, r), t;
}
function Ff(r, t) {
  r.x1 = t[0][0], r.y1 = t[0][1], r.x2 = t[1][0], r.y2 = t[1][1], r.percent = 1;
  var e = t[2];
  e ? (r.cpx1 = e[0], r.cpy1 = e[1]) : (r.cpx1 = NaN, r.cpy1 = NaN);
}
var pI = (
  /** @class */
  (function(r) {
    F(t, r);
    function t(e, i, n) {
      var a = r.call(this) || this;
      return a._createLine(e, i, n), a;
    }
    return t.prototype._createLine = function(e, i, n) {
      var a = e.hostModel, o = e.getItemLayout(i), s = cI(o);
      s.shape.percent = 0, Oe(s, {
        shape: {
          percent: 1
        }
      }, a, i), this.add(s), T(_u, function(l) {
        var u = Id(l, e, i);
        this.add(u), this[Dd(l)] = Ad(l, e, i);
      }, this), this._updateCommonStl(e, i, n);
    }, t.prototype.updateData = function(e, i, n) {
      var a = e.hostModel, o = this.childOfName("line"), s = e.getItemLayout(i), l = {
        shape: {}
      };
      Ff(l.shape, s), Wt(o, l, a, i), T(_u, function(u) {
        var f = Ad(u, e, i), h = Dd(u);
        if (this[h] !== f) {
          this.remove(this.childOfName(u));
          var c = Id(u, e, i);
          this.add(c);
        }
        this[h] = f;
      }, this), this._updateCommonStl(e, i, n);
    }, t.prototype.getLinePath = function() {
      return this.childAt(0);
    }, t.prototype._updateCommonStl = function(e, i, n) {
      var a = e.hostModel, o = this.childOfName("line"), s = n && n.emphasisLineStyle, l = n && n.blurLineStyle, u = n && n.selectLineStyle, f = n && n.labelStatesModels, h = n && n.emphasisDisabled, c = n && n.focus, v = n && n.blurScope;
      if (!n || e.hasItemOption) {
        var p = e.getItemModel(i), g = p.getModel("emphasis");
        s = g.getModel("lineStyle").getLineStyle(), l = p.getModel(["blur", "lineStyle"]).getLineStyle(), u = p.getModel(["select", "lineStyle"]).getLineStyle(), h = g.get("disabled"), c = g.get("focus"), v = g.get("blurScope"), f = Dr(p);
      }
      var d = e.getItemVisual(i, "style"), y = d.stroke;
      o.useStyle(d), o.style.fill = null, o.style.strokeNoScale = !0, o.ensureState("emphasis").style = s, o.ensureState("blur").style = l, o.ensureState("select").style = u, T(_u, function(b) {
        var x = this.childOfName(b);
        if (x) {
          x.setColor(y), x.style.opacity = d.opacity;
          for (var M = 0; M < de.length; M++) {
            var D = de[M], A = o.getState(D);
            if (A) {
              var C = A.style || {}, I = x.ensureState(D), L = I.style || (I.style = {});
              C.stroke != null && (L[x.__isEmptyBrush ? "stroke" : "fill"] = C.stroke), C.opacity != null && (L.opacity = C.opacity);
            }
          }
          x.markRedraw();
        }
      }, this);
      var m = a.getRawValue(i);
      nn(this, f, {
        labelDataIndex: i,
        labelFetcher: {
          getFormattedLabel: function(b, x) {
            return a.getFormattedLabel(b, x, e.dataType);
          }
        },
        inheritColor: y || "#000",
        defaultOpacity: d.opacity,
        defaultText: (m == null ? e.getName(i) : isFinite(m) ? St(m) : m) + ""
      });
      var _ = this.getTextContent();
      if (_) {
        var S = f.normal;
        _.__align = _.style.align, _.__verticalAlign = _.style.verticalAlign, _.__position = S.get("position") || "middle";
        var w = S.get("distance");
        O(w) || (w = [w, w]), _.__labelDistance = w;
      }
      this.setTextConfig({
        position: null,
        local: !0,
        inside: !1
        // Can't be inside for stroke element.
      }), Ji(this, c, v, h);
    }, t.prototype.highlight = function() {
      sa(this);
    }, t.prototype.downplay = function() {
      la(this);
    }, t.prototype.updateLayout = function(e, i) {
      this.setLinePoints(e.getItemLayout(i));
    }, t.prototype.setLinePoints = function(e) {
      var i = this.childOfName("line");
      Ff(i.shape, e), i.dirty();
    }, t.prototype.beforeUpdate = function() {
      var e = this, i = e.childOfName("fromSymbol"), n = e.childOfName("toSymbol"), a = e.getTextContent();
      if (!i && !n && (!a || a.ignore))
        return;
      for (var o = 1, s = this.parent; s; )
        s.scaleX && (o /= s.scaleX), s = s.parent;
      var l = e.childOfName("line");
      if (!this.__dirty && !l.__dirty)
        return;
      var u = l.shape.percent, f = l.pointAt(0), h = l.pointAt(u), c = Jf([], h, f);
      bs(c, c);
      function v(A, C) {
        var I = A.__specifiedRotation;
        if (I == null) {
          var L = l.tangentAt(C);
          A.attr("rotation", (C === 1 ? -1 : 1) * Math.PI / 2 - Math.atan2(L[1], L[0]));
        } else
          A.attr("rotation", I);
      }
      if (i && (i.setPosition(f), v(i, 0), i.scaleX = i.scaleY = o * u, i.markRedraw()), n && (n.setPosition(h), v(n, 1), n.scaleX = n.scaleY = o * u, n.markRedraw()), a && !a.ignore) {
        a.x = a.y = 0, a.originX = a.originY = 0;
        var p = void 0, g = void 0, d = a.__labelDistance, y = d[0] * o, m = d[1] * o, _ = u / 2, S = l.tangentAt(_), w = [S[1], -S[0]], b = l.pointAt(_);
        w[1] > 0 && (w[0] = -w[0], w[1] = -w[1]);
        var x = S[0] < 0 ? -1 : 1;
        if (a.__position !== "start" && a.__position !== "end") {
          var M = -Math.atan2(S[1], S[0]);
          h[0] < f[0] && (M = Math.PI + M), a.rotation = M;
        }
        var D = void 0;
        switch (a.__position) {
          case "insideStartTop":
          case "insideMiddleTop":
          case "insideEndTop":
          case "middle":
            D = -m, g = "bottom";
            break;
          case "insideStartBottom":
          case "insideMiddleBottom":
          case "insideEndBottom":
            D = m, g = "top";
            break;
          default:
            D = 0, g = "middle";
        }
        switch (a.__position) {
          case "end":
            a.x = c[0] * y + h[0], a.y = c[1] * m + h[1], p = c[0] > 0.8 ? "left" : c[0] < -0.8 ? "right" : "center", g = c[1] > 0.8 ? "top" : c[1] < -0.8 ? "bottom" : "middle";
            break;
          case "start":
            a.x = -c[0] * y + f[0], a.y = -c[1] * m + f[1], p = c[0] > 0.8 ? "right" : c[0] < -0.8 ? "left" : "center", g = c[1] > 0.8 ? "bottom" : c[1] < -0.8 ? "top" : "middle";
            break;
          case "insideStartTop":
          case "insideStart":
          case "insideStartBottom":
            a.x = y * x + f[0], a.y = f[1] + D, p = S[0] < 0 ? "right" : "left", a.originX = -y * x, a.originY = -D;
            break;
          case "insideMiddleTop":
          case "insideMiddle":
          case "insideMiddleBottom":
          case "middle":
            a.x = b[0], a.y = b[1] + D, p = "center", a.originY = -D;
            break;
          case "insideEndTop":
          case "insideEnd":
          case "insideEndBottom":
            a.x = -y * x + h[0], a.y = h[1] + D, p = S[0] >= 0 ? "right" : "left", a.originX = y * x, a.originY = -D;
            break;
        }
        a.scaleX = a.scaleY = o, a.setStyle({
          // Use the user specified text align and baseline first
          verticalAlign: a.__verticalAlign || g,
          align: a.__align || p
        });
      }
    }, t;
  })(gt)
), dI = (
  /** @class */
  (function() {
    function r(t) {
      this.group = new gt(), this._LineCtor = t || pI;
    }
    return r.prototype.updateData = function(t) {
      var e = this;
      this._progressiveEls = null;
      var i = this, n = i.group, a = i._lineData;
      i._lineData = t, a || n.removeAll();
      var o = Ld(t);
      t.diff(a).add(function(s) {
        e._doAdd(t, s, o);
      }).update(function(s, l) {
        e._doUpdate(a, t, l, s, o);
      }).remove(function(s) {
        n.remove(a.getItemGraphicEl(s));
      }).execute();
    }, r.prototype.updateLayout = function() {
      var t = this._lineData;
      t && t.eachItemGraphicEl(function(e, i) {
        e.updateLayout(t, i);
      }, this);
    }, r.prototype.incrementalPrepareUpdate = function(t) {
      this._seriesScope = Ld(t), this._lineData = null, this.group.removeAll();
    }, r.prototype.incrementalUpdate = function(t, e) {
      this._progressiveEls = [];
      function i(s) {
        !s.isGroup && !gI(s) && (s.incremental = !0, s.ensureState("emphasis").hoverLayer = !0);
      }
      for (var n = t.start; n < t.end; n++) {
        var a = e.getItemLayout(n);
        if (Su(a)) {
          var o = new this._LineCtor(e, n, this._seriesScope);
          o.traverse(i), this.group.add(o), e.setItemGraphicEl(n, o), this._progressiveEls.push(o);
        }
      }
    }, r.prototype.remove = function() {
      this.group.removeAll();
    }, r.prototype.eachRendered = function(t) {
      rn(this._progressiveEls || this.group, t);
    }, r.prototype._doAdd = function(t, e, i) {
      var n = t.getItemLayout(e);
      if (Su(n)) {
        var a = new this._LineCtor(t, e, i);
        t.setItemGraphicEl(e, a), this.group.add(a);
      }
    }, r.prototype._doUpdate = function(t, e, i, n, a) {
      var o = t.getItemGraphicEl(i);
      if (!Su(e.getItemLayout(n))) {
        this.group.remove(o);
        return;
      }
      o ? o.updateData(e, n, a) : o = new this._LineCtor(e, n, a), e.setItemGraphicEl(n, o), this.group.add(o);
    }, r;
  })()
);
function gI(r) {
  return r.animators && r.animators.length > 0;
}
function Ld(r) {
  var t = r.hostModel, e = t.getModel("emphasis");
  return {
    lineStyle: t.getModel("lineStyle").getLineStyle(),
    emphasisLineStyle: e.getModel(["lineStyle"]).getLineStyle(),
    blurLineStyle: t.getModel(["blur", "lineStyle"]).getLineStyle(),
    selectLineStyle: t.getModel(["select", "lineStyle"]).getLineStyle(),
    emphasisDisabled: e.get("disabled"),
    blurScope: e.get("blurScope"),
    focus: e.get("focus"),
    labelStatesModels: Dr(t)
  };
}
function Pd(r) {
  return isNaN(r[0]) || isNaN(r[1]);
}
function Su(r) {
  return r && !Pd(r[0]) && !Pd(r[1]);
}
function yI(r, t, e, i, n, a) {
  r = r || 0;
  var o = e[1] - e[0];
  if (n != null && (n = ki(n, [0, o])), a != null && (a = Math.max(a, n ?? 0)), i === "all") {
    var s = Math.abs(t[1] - t[0]);
    s = ki(s, [0, o]), n = a = ki(s, [n, a]), i = 0;
  }
  t[0] = ki(t[0], e), t[1] = ki(t[1], e);
  var l = bu(t, i);
  t[i] += r;
  var u = n || 0, f = e.slice();
  l.sign < 0 ? f[0] += u : f[1] -= u, t[i] = ki(t[i], f);
  var h;
  return h = bu(t, i), n != null && (h.sign !== l.sign || h.span < n) && (t[1 - i] = t[i] + l.sign * n), h = bu(t, i), a != null && h.span > a && (t[1 - i] = t[i] + h.sign * a), t;
}
function bu(r, t) {
  var e = r[t] - r[1 - t];
  return {
    span: Math.abs(e),
    sign: e > 0 ? -1 : e < 0 ? 1 : t ? -1 : 1
  };
}
function ki(r, t) {
  return Math.min(t[1] != null ? t[1] : 1 / 0, Math.max(t[0] != null ? t[0] : -1 / 0, r));
}
var mI = 256, _I = (
  /** @class */
  (function() {
    function r() {
      this.blurSize = 30, this.pointSize = 20, this.maxOpacity = 1, this.minOpacity = 0, this._gradientPixels = {
        inRange: null,
        outOfRange: null
      };
      var t = Re.createCanvas();
      this.canvas = t;
    }
    return r.prototype.update = function(t, e, i, n, a, o) {
      var s = this._getBrush(), l = this._getGradient(a, "inRange"), u = this._getGradient(a, "outOfRange"), f = this.pointSize + this.blurSize, h = this.canvas, c = h.getContext("2d"), v = t.length;
      h.width = e, h.height = i;
      for (var p = 0; p < v; ++p) {
        var g = t[p], d = g[0], y = g[1], m = g[2], _ = n(m);
        c.globalAlpha = _, c.drawImage(s, d - f, y - f);
      }
      if (!h.width || !h.height)
        return h;
      for (var S = c.getImageData(0, 0, h.width, h.height), w = S.data, b = 0, x = w.length, M = this.minOpacity, D = this.maxOpacity, A = D - M; b < x; ) {
        var _ = w[b + 3] / 256, C = Math.floor(_ * (mI - 1)) * 4;
        if (_ > 0) {
          var I = o(_) ? l : u;
          _ > 0 && (_ = _ * A + M), w[b++] = I[C], w[b++] = I[C + 1], w[b++] = I[C + 2], w[b++] = I[C + 3] * _ * 256;
        } else
          b += 4;
      }
      return c.putImageData(S, 0, 0), h;
    }, r.prototype._getBrush = function() {
      var t = this._brushCanvas || (this._brushCanvas = Re.createCanvas()), e = this.pointSize + this.blurSize, i = e * 2;
      t.width = i, t.height = i;
      var n = t.getContext("2d");
      return n.clearRect(0, 0, i, i), n.shadowOffsetX = i, n.shadowBlur = this.blurSize, n.shadowColor = "#000", n.beginPath(), n.arc(-e, e, this.pointSize, 0, Math.PI * 2, !0), n.closePath(), n.fill(), t;
    }, r.prototype._getGradient = function(t, e) {
      for (var i = this._gradientPixels, n = i[e] || (i[e] = new Uint8ClampedArray(256 * 4)), a = [0, 0, 0, 0], o = 0, s = 0; s < 256; s++)
        t[e](s / 255, !0, a), n[o++] = a[0], n[o++] = a[1], n[o++] = a[2], n[o++] = a[3];
      return n;
    }, r;
  })()
);
function SI(r, t, e) {
  var i = r[1] - r[0];
  t = z(t, function(o) {
    return {
      interval: [(o.interval[0] - r[0]) / i, (o.interval[1] - r[0]) / i]
    };
  });
  var n = t.length, a = 0;
  return function(o) {
    var s;
    for (s = a; s < n; s++) {
      var l = t[s].interval;
      if (l[0] <= o && o <= l[1]) {
        a = s;
        break;
      }
    }
    if (s === n)
      for (s = a - 1; s >= 0; s--) {
        var l = t[s].interval;
        if (l[0] <= o && o <= l[1]) {
          a = s;
          break;
        }
      }
    return s >= 0 && s < n && e[s];
  };
}
function bI(r, t) {
  var e = r[1] - r[0];
  return t = [(t[0] - r[0]) / e, (t[1] - r[0]) / e], function(i) {
    return i >= t[0] && i <= t[1];
  };
}
function Rd(r) {
  var t = r.dimensions;
  return t[0] === "lng" && t[1] === "lat";
}
var wI = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e;
    }
    return t.prototype.render = function(e, i, n) {
      var a;
      i.eachComponent("visualMap", function(s) {
        s.eachTargetSeries(function(l) {
          l === e && (a = s);
        });
      }), this._progressiveEls = null, this.group.removeAll();
      var o = e.coordinateSystem;
      o.type === "cartesian2d" || o.type === "calendar" ? this._renderOnCartesianAndCalendar(e, n, 0, e.getData().count()) : Rd(o) && this._renderOnGeo(o, e, a, n);
    }, t.prototype.incrementalPrepareRender = function(e, i, n) {
      this.group.removeAll();
    }, t.prototype.incrementalRender = function(e, i, n, a) {
      var o = i.coordinateSystem;
      o && (Rd(o) ? this.render(i, n, a) : (this._progressiveEls = [], this._renderOnCartesianAndCalendar(i, a, e.start, e.end, !0)));
    }, t.prototype.eachRendered = function(e) {
      rn(this._progressiveEls || this.group, e);
    }, t.prototype._renderOnCartesianAndCalendar = function(e, i, n, a, o) {
      var s = e.coordinateSystem, l = Oa(s, "cartesian2d"), u, f, h, c;
      if (l) {
        var v = s.getAxis("x"), p = s.getAxis("y");
        u = v.getBandWidth() + 0.5, f = p.getBandWidth() + 0.5, h = v.scale.getExtent(), c = p.scale.getExtent();
      }
      for (var g = this.group, d = e.getData(), y = e.getModel(["emphasis", "itemStyle"]).getItemStyle(), m = e.getModel(["blur", "itemStyle"]).getItemStyle(), _ = e.getModel(["select", "itemStyle"]).getItemStyle(), S = e.get(["itemStyle", "borderRadius"]), w = Dr(e), b = e.getModel("emphasis"), x = b.get("focus"), M = b.get("blurScope"), D = b.get("disabled"), A = l ? [d.mapDimension("x"), d.mapDimension("y"), d.mapDimension("value")] : [d.mapDimension("time"), d.mapDimension("value")], C = n; C < a; C++) {
        var I = void 0, L = d.getItemVisual(C, "style");
        if (l) {
          var P = d.get(A[0], C), R = d.get(A[1], C);
          if (isNaN(d.get(A[2], C)) || isNaN(P) || isNaN(R) || P < h[0] || P > h[1] || R < c[0] || R > c[1])
            continue;
          var E = s.dataToPoint([P, R]);
          I = new dt({
            shape: {
              x: E[0] - u / 2,
              y: E[1] - f / 2,
              width: u,
              height: f
            },
            style: L
          });
        } else {
          if (isNaN(d.get(A[1], C)))
            continue;
          I = new dt({
            z2: 1,
            shape: s.dataToRect([d.get(A[0], C)]).contentShape,
            style: L
          });
        }
        if (d.hasItemOption) {
          var G = d.getItemModel(C), N = G.getModel("emphasis");
          y = N.getModel("itemStyle").getItemStyle(), m = G.getModel(["blur", "itemStyle"]).getItemStyle(), _ = G.getModel(["select", "itemStyle"]).getItemStyle(), S = G.get(["itemStyle", "borderRadius"]), x = N.get("focus"), M = N.get("blurScope"), D = N.get("disabled"), w = Dr(G);
        }
        I.shape.r = S;
        var B = e.getRawValue(C), W = "-";
        B && B[2] != null && (W = B[2] + ""), nn(I, w, {
          labelFetcher: e,
          labelDataIndex: C,
          defaultOpacity: L.opacity,
          defaultText: W
        }), I.ensureState("emphasis").style = y, I.ensureState("blur").style = m, I.ensureState("select").style = _, Ji(I, x, M, D), I.incremental = o, o && (I.states.emphasis.hoverLayer = !0), g.add(I), d.setItemGraphicEl(C, I), this._progressiveEls && this._progressiveEls.push(I);
      }
    }, t.prototype._renderOnGeo = function(e, i, n, a) {
      var o = n.targetVisuals.inRange, s = n.targetVisuals.outOfRange, l = i.getData(), u = this._hmLayer || this._hmLayer || new _I();
      u.blurSize = i.get("blurSize"), u.pointSize = i.get("pointSize"), u.minOpacity = i.get("minOpacity"), u.maxOpacity = i.get("maxOpacity");
      var f = e.getViewRect().clone(), h = e.getRoamTransform();
      f.applyTransform(h);
      var c = Math.max(f.x, 0), v = Math.max(f.y, 0), p = Math.min(f.width + f.x, a.getWidth()), g = Math.min(f.height + f.y, a.getHeight()), d = p - c, y = g - v, m = [l.mapDimension("lng"), l.mapDimension("lat"), l.mapDimension("value")], _ = l.mapArray(m, function(x, M, D) {
        var A = e.dataToPoint([x, M]);
        return A[0] -= c, A[1] -= v, A.push(D), A;
      }), S = n.getExtent(), w = n.type === "visualMap.continuous" ? bI(S, n.option.range) : SI(S, n.getPieceList(), n.option.selected);
      u.update(_, d, y, o.color.getNormalizer(), {
        inRange: o.color.getColorMapper(),
        outOfRange: s.color.getColorMapper()
      }, w);
      var b = new ke({
        style: {
          width: d,
          height: y,
          x: c,
          y: v,
          image: u.canvas
        },
        silent: !0
      });
      this.group.add(b);
    }, t.type = "heatmap", t;
  })(Et)
), xI = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e;
    }
    return t.prototype.getInitialData = function(e, i) {
      return sn(null, this, {
        generateCoord: "value"
      });
    }, t.prototype.preventIncremental = function() {
      var e = Ra.get(this.get("coordinateSystem"));
      if (e && e.dimensions)
        return e.dimensions[0] === "lng" && e.dimensions[1] === "lat";
    }, t.type = "series.heatmap", t.dependencies = ["grid", "geo", "calendar"], t.defaultOption = {
      coordinateSystem: "cartesian2d",
      // zlevel: 0,
      z: 2,
      // Cartesian coordinate system
      // xAxisIndex: 0,
      // yAxisIndex: 0,
      // Geo coordinate system
      geoIndex: 0,
      blurSize: 30,
      pointSize: 20,
      maxOpacity: 1,
      minOpacity: 0,
      select: {
        itemStyle: {
          borderColor: "#212121"
        }
      }
    }, t;
  })(Ut)
);
function TI(r) {
  r.registerChartView(wI), r.registerSeriesModel(xI);
}
var ei = bt(), Ed = U, wu = Q, CI = (
  /** @class */
  (function() {
    function r() {
      this._dragging = !1, this.animationThreshold = 15;
    }
    return r.prototype.render = function(t, e, i, n) {
      var a = e.get("value"), o = e.get("status");
      if (this._axisModel = t, this._axisPointerModel = e, this._api = i, !(!n && this._lastValue === a && this._lastStatus === o)) {
        this._lastValue = a, this._lastStatus = o;
        var s = this._group, l = this._handle;
        if (!o || o === "hide") {
          s && s.hide(), l && l.hide();
          return;
        }
        s && s.show(), l && l.show();
        var u = {};
        this.makeElOption(u, a, t, e, i);
        var f = u.graphicKey;
        f !== this._lastGraphicKey && this.clear(i), this._lastGraphicKey = f;
        var h = this._moveAnimation = this.determineAnimation(t, e);
        if (!s)
          s = this._group = new gt(), this.createPointerEl(s, u, t, e), this.createLabelEl(s, u, t, e), i.getZr().add(s);
        else {
          var c = ht(Od, e, h);
          this.updatePointerEl(s, u, c), this.updateLabelEl(s, u, c, e);
        }
        Nd(s, e, !0), this._renderHandle(a);
      }
    }, r.prototype.remove = function(t) {
      this.clear(t);
    }, r.prototype.dispose = function(t) {
      this.clear(t);
    }, r.prototype.determineAnimation = function(t, e) {
      var i = e.get("animation"), n = t.axis, a = n.type === "category", o = e.get("snap");
      if (!o && !a)
        return !1;
      if (i === "auto" || i == null) {
        var s = this.animationThreshold;
        if (a && n.getBandWidth() > s)
          return !0;
        if (o) {
          var l = sv(t).seriesDataCount, u = n.getExtent();
          return Math.abs(u[0] - u[1]) / l > s;
        }
        return !1;
      }
      return i === !0;
    }, r.prototype.makeElOption = function(t, e, i, n, a) {
    }, r.prototype.createPointerEl = function(t, e, i, n) {
      var a = e.pointer;
      if (a) {
        var o = ei(t).pointerEl = new Uw[a.type](Ed(e.pointer));
        t.add(o);
      }
    }, r.prototype.createLabelEl = function(t, e, i, n) {
      if (e.label) {
        var a = ei(t).labelEl = new mt(Ed(e.label));
        t.add(a), kd(a, n);
      }
    }, r.prototype.updatePointerEl = function(t, e, i) {
      var n = ei(t).pointerEl;
      n && e.pointer && (n.setStyle(e.pointer.style), i(n, {
        shape: e.pointer.shape
      }));
    }, r.prototype.updateLabelEl = function(t, e, i, n) {
      var a = ei(t).labelEl;
      a && (a.setStyle(e.label.style), i(a, {
        // Consider text length change in vertical axis, animation should
        // be used on shape, otherwise the effect will be weird.
        // TODOTODO
        // shape: elOption.label.shape,
        x: e.label.x,
        y: e.label.y
      }), kd(a, n));
    }, r.prototype._renderHandle = function(t) {
      if (!(this._dragging || !this.updateHandleTransform)) {
        var e = this._axisPointerModel, i = this._api.getZr(), n = this._handle, a = e.getModel("handle"), o = e.get("status");
        if (!a.get("show") || !o || o === "hide") {
          n && i.remove(n), this._handle = null;
          return;
        }
        var s;
        this._handle || (s = !0, n = this._handle = Ns(a.get("icon"), {
          cursor: "move",
          draggable: !0,
          onmousemove: function(u) {
            jn(u.event);
          },
          onmousedown: wu(this._onHandleDragMove, this, 0, 0),
          drift: wu(this._onHandleDragMove, this),
          ondragend: wu(this._onHandleDragEnd, this)
        }), i.add(n)), Nd(n, e, !1), n.setStyle(a.getItemStyle(null, ["color", "borderColor", "borderWidth", "opacity", "shadowColor", "shadowBlur", "shadowOffsetX", "shadowOffsetY"]));
        var l = a.get("size");
        O(l) || (l = [l, l]), n.scaleX = l[0] / 2, n.scaleY = l[1] / 2, Pm(this, "_doDispatchAxisPointer", a.get("throttle") || 0, "fixRate"), this._moveHandleToValue(t, s);
      }
    }, r.prototype._moveHandleToValue = function(t, e) {
      Od(this._axisPointerModel, !e && this._moveAnimation, this._handle, xu(this.getHandleTransform(t, this._axisModel, this._axisPointerModel)));
    }, r.prototype._onHandleDragMove = function(t, e) {
      var i = this._handle;
      if (i) {
        this._dragging = !0;
        var n = this.updateHandleTransform(xu(i), [t, e], this._axisModel, this._axisPointerModel);
        this._payloadInfo = n, i.stopAnimation(), i.attr(xu(n)), ei(i).lastProp = null, this._doDispatchAxisPointer();
      }
    }, r.prototype._doDispatchAxisPointer = function() {
      var t = this._handle;
      if (t) {
        var e = this._payloadInfo, i = this._axisModel;
        this._api.dispatchAction({
          type: "updateAxisPointer",
          x: e.cursorPoint[0],
          y: e.cursorPoint[1],
          tooltipOption: e.tooltipOption,
          axesInfo: [{
            axisDim: i.axis.dim,
            axisIndex: i.componentIndex
          }]
        });
      }
    }, r.prototype._onHandleDragEnd = function() {
      this._dragging = !1;
      var t = this._handle;
      if (t) {
        var e = this._axisPointerModel.get("value");
        this._moveHandleToValue(e), this._api.dispatchAction({
          type: "hideTip"
        });
      }
    }, r.prototype.clear = function(t) {
      this._lastValue = null, this._lastStatus = null;
      var e = t.getZr(), i = this._group, n = this._handle;
      e && i && (this._lastGraphicKey = null, i && e.remove(i), n && e.remove(n), this._group = null, this._handle = null, this._payloadInfo = null), mf(this, "_doDispatchAxisPointer");
    }, r.prototype.doClear = function() {
    }, r.prototype.buildLabel = function(t, e, i) {
      return i = i || 0, {
        x: t[i],
        y: t[1 - i],
        width: e[i],
        height: e[1 - i]
      };
    }, r;
  })()
);
function Od(r, t, e, i) {
  u_(ei(e).lastProp, i) || (ei(e).lastProp = i, t ? Wt(e, i, r) : (e.stopAnimation(), e.attr(i)));
}
function u_(r, t) {
  if (H(r) && H(t)) {
    var e = !0;
    return T(t, function(i, n) {
      e = e && u_(r[n], i);
    }), !!e;
  } else
    return r === t;
}
function kd(r, t) {
  r[t.get(["label", "show"]) ? "show" : "hide"]();
}
function xu(r) {
  return {
    x: r.x || 0,
    y: r.y || 0,
    rotation: r.rotation || 0
  };
}
function Nd(r, t, e) {
  var i = t.get("z"), n = t.get("zlevel");
  r && r.traverse(function(a) {
    a.type !== "group" && (i != null && (a.z = i), n != null && (a.zlevel = n), a.silent = e);
  });
}
function MI(r) {
  var t = r.get("type"), e = r.getModel(t + "Style"), i;
  return t === "line" ? (i = e.getLineStyle(), i.fill = null) : t === "shadow" && (i = e.getAreaStyle(), i.stroke = null), i;
}
function DI(r, t, e, i, n) {
  var a = e.get("value"), o = f_(a, t.axis, t.ecModel, e.get("seriesDataIndices"), {
    precision: e.get(["label", "precision"]),
    formatter: e.get(["label", "formatter"])
  }), s = e.getModel("label"), l = an(s.get("padding") || 0), u = s.getFont(), f = oh(o, u), h = n.position, c = f.width + l[1] + l[3], v = f.height + l[0] + l[2], p = n.align;
  p === "right" && (h[0] -= c), p === "center" && (h[0] -= c / 2);
  var g = n.verticalAlign;
  g === "bottom" && (h[1] -= v), g === "middle" && (h[1] -= v / 2), AI(h, c, v, i);
  var d = s.get("backgroundColor");
  (!d || d === "auto") && (d = t.get(["axisLine", "lineStyle", "color"])), r.label = {
    // shape: {x: 0, y: 0, width: width, height: height, r: labelModel.get('borderRadius')},
    x: h[0],
    y: h[1],
    style: re(s, {
      text: o,
      font: u,
      fill: s.getTextColor(),
      padding: l,
      backgroundColor: d
    }),
    // Label should be over axisPointer.
    z2: 10
  };
}
function AI(r, t, e, i) {
  var n = i.getWidth(), a = i.getHeight();
  r[0] = Math.min(r[0] + t, n) - t, r[1] = Math.min(r[1] + e, a) - e, r[0] = Math.max(r[0], 0), r[1] = Math.max(r[1], 0);
}
function f_(r, t, e, i, n) {
  r = t.scale.parse(r);
  var a = t.scale.getLabel({
    value: r
  }, {
    // If `precision` is set, width can be fixed (like '12.00500'), which
    // helps to debounce when when moving label.
    precision: n.precision
  }), o = n.formatter;
  if (o) {
    var s = {
      value: ev(t, {
        value: r
      }),
      axisDimension: t.dim,
      axisIndex: t.index,
      seriesData: []
    };
    T(i, function(l) {
      var u = e.getSeriesByIndex(l.seriesIndex), f = l.dataIndexInside, h = u && u.getDataParams(f);
      h && s.seriesData.push(h);
    }), V(o) ? a = o.replace("{value}", a) : X(o) && (a = o(s));
  }
  return a;
}
function h_(r, t, e) {
  var i = Sr();
  return ws(i, i, e.rotation), Yo(i, i, e.position), Yi([r.dataToCoord(t), (e.labelOffset || 0) + (e.labelDirection || 1) * (e.labelMargin || 0)], i);
}
function II(r, t, e, i, n, a) {
  var o = Tr.innerTextLayout(e.rotation, 0, e.labelDirection);
  e.labelMargin = n.get(["label", "margin"]), DI(t, i, n, a, {
    position: h_(i.axis, r, e),
    align: o.textAlign,
    verticalAlign: o.textVerticalAlign
  });
}
function LI(r, t, e) {
  return e = e || 0, {
    x1: r[e],
    y1: r[1 - e],
    x2: t[e],
    y2: t[1 - e]
  };
}
function PI(r, t, e) {
  return e = e || 0, {
    x: r[e],
    y: r[1 - e],
    width: t[e],
    height: t[1 - e]
  };
}
var RI = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      return r !== null && r.apply(this, arguments) || this;
    }
    return t.prototype.makeElOption = function(e, i, n, a, o) {
      var s = n.axis, l = s.grid, u = a.get("type"), f = Bd(l, s).getOtherAxis(s).getGlobalExtent(), h = s.toGlobalCoord(s.dataToCoord(i, !0));
      if (u && u !== "none") {
        var c = MI(a), v = EI[u](s, h, f);
        v.style = c, e.graphicKey = v.type, e.pointer = v;
      }
      var p = Of(l.model, n);
      II(
        // @ts-ignore
        i,
        e,
        p,
        n,
        a,
        o
      );
    }, t.prototype.getHandleTransform = function(e, i, n) {
      var a = Of(i.axis.grid.model, i, {
        labelInside: !1
      });
      a.labelMargin = n.get(["handle", "margin"]);
      var o = h_(i.axis, e, a);
      return {
        x: o[0],
        y: o[1],
        rotation: a.rotation + (a.labelDirection < 0 ? Math.PI : 0)
      };
    }, t.prototype.updateHandleTransform = function(e, i, n, a) {
      var o = n.axis, s = o.grid, l = o.getGlobalExtent(!0), u = Bd(s, o).getOtherAxis(o).getGlobalExtent(), f = o.dim === "x" ? 0 : 1, h = [e.x, e.y];
      h[f] += i[f], h[f] = Math.min(l[1], h[f]), h[f] = Math.max(l[0], h[f]);
      var c = (u[1] + u[0]) / 2, v = [c, c];
      v[f] = h[f];
      var p = [{
        verticalAlign: "middle"
      }, {
        align: "center"
      }];
      return {
        x: h[0],
        y: h[1],
        rotation: e.rotation,
        cursorPoint: v,
        tooltipOption: p[f]
      };
    }, t;
  })(CI)
);
function Bd(r, t) {
  var e = {};
  return e[t.dim + "AxisIndex"] = t.index, r.getCartesian(e);
}
var EI = {
  line: function(r, t, e) {
    var i = LI([t, e[0]], [t, e[1]], zd(r));
    return {
      type: "Line",
      subPixelOptimize: !0,
      shape: i
    };
  },
  shadow: function(r, t, e) {
    var i = Math.max(1, r.getBandWidth()), n = e[1] - e[0];
    return {
      type: "Rect",
      shape: PI([t - i / 2, e[0]], [i, n], zd(r))
    };
  }
};
function zd(r) {
  return r.dim === "x" ? 0 : 1;
}
var OI = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e;
    }
    return t.type = "axisPointer", t.defaultOption = {
      // 'auto' means that show when triggered by tooltip or handle.
      show: "auto",
      // zlevel: 0,
      z: 50,
      type: "line",
      // axispointer triggered by tootip determine snap automatically,
      // see `modelHelper`.
      snap: !1,
      triggerTooltip: !0,
      triggerEmphasis: !0,
      value: null,
      status: null,
      link: [],
      // Do not set 'auto' here, otherwise global animation: false
      // will not effect at this axispointer.
      animation: null,
      animationDurationUpdate: 200,
      lineStyle: {
        color: "#B9BEC9",
        width: 1,
        type: "dashed"
      },
      shadowStyle: {
        color: "rgba(210,219,238,0.2)"
      },
      label: {
        show: !0,
        formatter: null,
        precision: "auto",
        margin: 3,
        color: "#fff",
        padding: [5, 7, 5, 7],
        backgroundColor: "auto",
        borderColor: null,
        borderWidth: 0,
        borderRadius: 3
      },
      handle: {
        show: !1,
        // eslint-disable-next-line
        icon: "M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4h1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7v-1.2h6.6z M13.3,22H6.7v-1.2h6.6z M13.3,19.6H6.7v-1.2h6.6z",
        size: 45,
        // handle margin is from symbol center to axis, which is stable when circular move.
        margin: 50,
        // color: '#1b8bbd'
        // color: '#2f4554'
        color: "#333",
        shadowBlur: 3,
        shadowColor: "#aaa",
        shadowOffsetX: 0,
        shadowOffsetY: 2,
        // For mobile performance
        throttle: 40
      }
    }, t;
  })(rt)
), er = bt(), kI = T;
function v_(r, t, e) {
  if (!Y.node) {
    var i = t.getZr();
    er(i).records || (er(i).records = {}), NI(i, t);
    var n = er(i).records[r] || (er(i).records[r] = {});
    n.handler = e;
  }
}
function NI(r, t) {
  if (er(r).initialized)
    return;
  er(r).initialized = !0, e("click", ht(Fd, "click")), e("mousemove", ht(Fd, "mousemove")), e("globalout", zI);
  function e(i, n) {
    r.on(i, function(a) {
      var o = FI(t);
      kI(er(r).records, function(s) {
        s && n(s, a, o.dispatchAction);
      }), BI(o.pendings, t);
    });
  }
}
function BI(r, t) {
  var e = r.showTip.length, i = r.hideTip.length, n;
  e ? n = r.showTip[e - 1] : i && (n = r.hideTip[i - 1]), n && (n.dispatchAction = null, t.dispatchAction(n));
}
function zI(r, t, e) {
  r.handler("leave", null, e);
}
function Fd(r, t, e, i) {
  t.handler(r, e, i);
}
function FI(r) {
  var t = {
    showTip: [],
    hideTip: []
  }, e = function(i) {
    var n = t[i.type];
    n ? n.push(i) : (i.dispatchAction = e, r.dispatchAction(i));
  };
  return {
    dispatchAction: e,
    pendings: t
  };
}
function Vf(r, t) {
  if (!Y.node) {
    var e = t.getZr(), i = (er(e).records || {})[r];
    i && (er(e).records[r] = null);
  }
}
var VI = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e;
    }
    return t.prototype.render = function(e, i, n) {
      var a = i.getComponent("tooltip"), o = e.get("triggerOn") || a && a.get("triggerOn") || "mousemove|click";
      v_("axisPointer", n, function(s, l, u) {
        o !== "none" && (s === "leave" || o.indexOf(s) >= 0) && u({
          type: "updateAxisPointer",
          currTrigger: s,
          x: l && l.offsetX,
          y: l && l.offsetY
        });
      });
    }, t.prototype.remove = function(e, i) {
      Vf("axisPointer", i);
    }, t.prototype.dispose = function(e, i) {
      Vf("axisPointer", i);
    }, t.type = "axisPointer", t;
  })(kt)
);
function c_(r, t) {
  var e = [], i = r.seriesIndex, n;
  if (i == null || !(n = t.getSeriesByIndex(i)))
    return {
      point: []
    };
  var a = n.getData(), o = ci(a, r);
  if (o == null || o < 0 || O(o))
    return {
      point: []
    };
  var s = a.getItemGraphicEl(o), l = n.coordinateSystem;
  if (n.getTooltipPosition)
    e = n.getTooltipPosition(o) || [];
  else if (l && l.dataToPoint)
    if (r.isStacked) {
      var u = l.getBaseAxis(), f = l.getOtherAxis(u), h = f.dim, c = u.dim, v = h === "x" || h === "radius" ? 1 : 0, p = a.mapDimension(c), g = [];
      g[v] = a.get(p, o), g[1 - v] = a.get(a.getCalculationInfo("stackResultDimension"), o), e = l.dataToPoint(g) || [];
    } else
      e = l.dataToPoint(a.getValues(z(l.dimensions, function(y) {
        return a.mapDimension(y);
      }), o)) || [];
  else if (s) {
    var d = s.getBoundingRect().clone();
    d.applyTransform(s.transform), e = [d.x + d.width / 2, d.y + d.height / 2];
  }
  return {
    point: e,
    el: s
  };
}
var Vd = bt();
function HI(r, t, e) {
  var i = r.currTrigger, n = [r.x, r.y], a = r, o = r.dispatchAction || Q(e.dispatchAction, e), s = t.getComponent("axisPointer").coordSysAxesInfo;
  if (s) {
    Vo(n) && (n = c_({
      seriesIndex: a.seriesIndex,
      // Do not use dataIndexInside from other ec instance.
      // FIXME: auto detect it?
      dataIndex: a.dataIndex
    }, t).point);
    var l = Vo(n), u = a.axesInfo, f = s.axesInfo, h = i === "leave" || Vo(n), c = {}, v = {}, p = {
      list: [],
      map: {}
    }, g = {
      showPointer: ht(WI, v),
      showTooltip: ht(UI, p)
    };
    T(s.coordSysMap, function(y, m) {
      var _ = l || y.containPoint(n);
      T(s.coordSysAxesInfo[m], function(S, w) {
        var b = S.axis, x = ZI(u, S);
        if (!h && _ && (!u || x)) {
          var M = x && x.value;
          M == null && !l && (M = b.pointToData(n)), M != null && Hd(S, M, g, !1, c);
        }
      });
    });
    var d = {};
    return T(f, function(y, m) {
      var _ = y.linkGroup;
      _ && !v[m] && T(_.axesInfo, function(S, w) {
        var b = v[w];
        if (S !== y && b) {
          var x = b.value;
          _.mapper && (x = y.axis.scale.parse(_.mapper(x, Gd(S), Gd(y)))), d[y.key] = x;
        }
      });
    }), T(d, function(y, m) {
      Hd(f[m], y, g, !0, c);
    }), YI(v, f, c), XI(p, n, r, o), $I(f, o, e), c;
  }
}
function Hd(r, t, e, i, n) {
  var a = r.axis;
  if (!(a.scale.isBlank() || !a.containData(t))) {
    if (!r.involveSeries) {
      e.showPointer(r, t);
      return;
    }
    var o = GI(t, r), s = o.payloadBatch, l = o.snapToValue;
    s[0] && n.seriesIndex == null && k(n, s[0]), !i && r.snap && a.containData(l) && l != null && (t = l), e.showPointer(r, t, s), e.showTooltip(r, o, l);
  }
}
function GI(r, t) {
  var e = t.axis, i = e.dim, n = r, a = [], o = Number.MAX_VALUE, s = -1;
  return T(t.seriesModels, function(l, u) {
    var f = l.getData().mapDimensionsAll(i), h, c;
    if (l.getAxisTooltipData) {
      var v = l.getAxisTooltipData(f, r, e);
      c = v.dataIndices, h = v.nestestValue;
    } else {
      if (c = l.getData().indicesOfNearest(
        f[0],
        r,
        // Add a threshold to avoid find the wrong dataIndex
        // when data length is not same.
        // false,
        e.type === "category" ? 0.5 : null
      ), !c.length)
        return;
      h = l.getData().get(f[0], c[0]);
    }
    if (!(h == null || !isFinite(h))) {
      var p = r - h, g = Math.abs(p);
      g <= o && ((g < o || p >= 0 && s < 0) && (o = g, s = p, n = h, a.length = 0), T(c, function(d) {
        a.push({
          seriesIndex: l.seriesIndex,
          dataIndexInside: d,
          dataIndex: l.getData().getRawIndex(d)
        });
      }));
    }
  }), {
    payloadBatch: a,
    snapToValue: n
  };
}
function WI(r, t, e, i) {
  r[t.key] = {
    value: e,
    payloadBatch: i
  };
}
function UI(r, t, e, i) {
  var n = e.payloadBatch, a = t.axis, o = a.model, s = t.axisPointerModel;
  if (!(!t.triggerTooltip || !n.length)) {
    var l = t.coordSys.model, u = ga(l), f = r.map[u];
    f || (f = r.map[u] = {
      coordSysId: l.id,
      coordSysIndex: l.componentIndex,
      coordSysType: l.type,
      coordSysMainType: l.mainType,
      dataByAxis: []
    }, r.list.push(f)), f.dataByAxis.push({
      axisDim: a.dim,
      axisIndex: o.componentIndex,
      axisType: o.type,
      axisId: o.id,
      value: i,
      // Caustion: viewHelper.getValueLabel is actually on "view stage", which
      // depends that all models have been updated. So it should not be performed
      // here. Considering axisPointerModel used here is volatile, which is hard
      // to be retrieve in TooltipView, we prepare parameters here.
      valueLabelOpt: {
        precision: s.get(["label", "precision"]),
        formatter: s.get(["label", "formatter"])
      },
      seriesDataIndices: n.slice()
    });
  }
}
function YI(r, t, e) {
  var i = e.axesInfo = [];
  T(t, function(n, a) {
    var o = n.axisPointerModel.option, s = r[a];
    s ? (!n.useHandle && (o.status = "show"), o.value = s.value, o.seriesDataIndices = (s.payloadBatch || []).slice()) : !n.useHandle && (o.status = "hide"), o.status === "show" && i.push({
      axisDim: n.axis.dim,
      axisIndex: n.axis.model.componentIndex,
      value: o.value
    });
  });
}
function XI(r, t, e, i) {
  if (Vo(t) || !r.list.length) {
    i({
      type: "hideTip"
    });
    return;
  }
  var n = ((r.list[0].dataByAxis[0] || {}).seriesDataIndices || [])[0] || {};
  i({
    type: "showTip",
    escapeConnect: !0,
    x: t[0],
    y: t[1],
    tooltipOption: e.tooltipOption,
    position: e.position,
    dataIndexInside: n.dataIndexInside,
    dataIndex: n.dataIndex,
    seriesIndex: n.seriesIndex,
    dataByCoordSys: r.list
  });
}
function $I(r, t, e) {
  var i = e.getZr(), n = "axisPointerLastHighlights", a = Vd(i)[n] || {}, o = Vd(i)[n] = {};
  T(r, function(u, f) {
    var h = u.axisPointerModel.option;
    h.status === "show" && u.triggerEmphasis && T(h.seriesDataIndices, function(c) {
      var v = c.seriesIndex + " | " + c.dataIndex;
      o[v] = c;
    });
  });
  var s = [], l = [];
  T(a, function(u, f) {
    !o[f] && l.push(u);
  }), T(o, function(u, f) {
    !a[f] && s.push(u);
  }), l.length && e.dispatchAction({
    type: "downplay",
    escapeConnect: !0,
    // Not blur others when highlight in axisPointer.
    notBlur: !0,
    batch: l
  }), s.length && e.dispatchAction({
    type: "highlight",
    escapeConnect: !0,
    // Not blur others when highlight in axisPointer.
    notBlur: !0,
    batch: s
  });
}
function ZI(r, t) {
  for (var e = 0; e < (r || []).length; e++) {
    var i = r[e];
    if (t.axis.dim === i.axisDim && t.axis.model.componentIndex === i.axisIndex)
      return i;
  }
}
function Gd(r) {
  var t = r.axis.model, e = {}, i = e.axisDim = r.axis.dim;
  return e.axisIndex = e[i + "AxisIndex"] = t.componentIndex, e.axisName = e[i + "AxisName"] = t.name, e.axisId = e[i + "AxisId"] = t.id, e;
}
function Vo(r) {
  return !r || r[0] == null || isNaN(r[0]) || r[1] == null || isNaN(r[1]);
}
function p_(r) {
  i_.registerAxisPointerClass("CartesianAxisPointer", RI), r.registerComponentModel(OI), r.registerComponentView(VI), r.registerPreprocessor(function(t) {
    if (t) {
      (!t.axisPointer || t.axisPointer.length === 0) && (t.axisPointer = {});
      var e = t.axisPointer.link;
      e && !O(e) && (t.axisPointer.link = [e]);
    }
  }), r.registerProcessor(r.PRIORITY.PROCESSOR.STATISTIC, function(t, e) {
    t.getComponent("axisPointer").coordSysAxesInfo = $A(t, e);
  }), r.registerAction({
    type: "updateAxisPointer",
    event: "updateAxisPointer",
    update: ":updateAxisPointer"
  }, HI);
}
function qI(r) {
  ye(o_), ye(p_);
}
function KI(r, t) {
  var e = an(t.get("padding")), i = t.getItemStyle(["color", "opacity"]);
  return i.fill = t.get("backgroundColor"), r = new dt({
    shape: {
      x: r.x - e[3],
      y: r.y - e[0],
      width: r.width + e[1] + e[3],
      height: r.height + e[0] + e[2],
      r: t.get("borderRadius")
    },
    style: i,
    silent: !0,
    z2: -1
  }), r;
}
var QI = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e;
    }
    return t.type = "tooltip", t.dependencies = ["axisPointer"], t.defaultOption = {
      // zlevel: 0,
      z: 60,
      show: !0,
      // tooltip main content
      showContent: !0,
      // 'trigger' only works on coordinate system.
      // 'item' | 'axis' | 'none'
      trigger: "item",
      // 'click' | 'mousemove' | 'none'
      triggerOn: "mousemove|click",
      alwaysShowContent: !1,
      displayMode: "single",
      renderMode: "auto",
      // whether restraint content inside viewRect.
      // If renderMode: 'richText', default true.
      // If renderMode: 'html', defaut false (for backward compat).
      confine: null,
      showDelay: 0,
      hideDelay: 100,
      // Animation transition time, unit is second
      transitionDuration: 0.4,
      enterable: !1,
      backgroundColor: "#fff",
      // box shadow
      shadowBlur: 10,
      shadowColor: "rgba(0, 0, 0, .2)",
      shadowOffsetX: 1,
      shadowOffsetY: 2,
      // tooltip border radius, unit is px, default is 4
      borderRadius: 4,
      // tooltip border width, unit is px, default is 0 (no border)
      borderWidth: 1,
      // Tooltip inside padding, default is 5 for all direction
      // Array is allowed to set up, right, bottom, left, same with css
      // The default value: See `tooltip/tooltipMarkup.ts#getPaddingFromTooltipModel`.
      padding: null,
      // Extra css text
      extraCssText: "",
      // axis indicator, trigger by axis
      axisPointer: {
        // default is line
        // legal values: 'line' | 'shadow' | 'cross'
        type: "line",
        // Valid when type is line, appoint tooltip line locate on which line. Optional
        // legal values: 'x' | 'y' | 'angle' | 'radius' | 'auto'
        // default is 'auto', chose the axis which type is category.
        // for multiply y axis, cartesian coord chose x axis, polar chose angle axis
        axis: "auto",
        animation: "auto",
        animationDurationUpdate: 200,
        animationEasingUpdate: "exponentialOut",
        crossStyle: {
          color: "#999",
          width: 1,
          type: "dashed",
          // TODO formatter
          textStyle: {}
        }
        // lineStyle and shadowStyle should not be specified here,
        // otherwise it will always override those styles on option.axisPointer.
      },
      textStyle: {
        color: "#666",
        fontSize: 14
      }
    }, t;
  })(rt)
);
function d_(r) {
  var t = r.get("confine");
  return t != null ? !!t : r.get("renderMode") === "richText";
}
function g_(r) {
  if (Y.domSupported) {
    for (var t = document.documentElement.style, e = 0, i = r.length; e < i; e++)
      if (r[e] in t)
        return r[e];
  }
}
var y_ = g_(["transform", "webkitTransform", "OTransform", "MozTransform", "msTransform"]), JI = g_(["webkitTransition", "transition", "OTransition", "MozTransition", "msTransition"]);
function m_(r, t) {
  if (!r)
    return t;
  t = Lh(t, !0);
  var e = r.indexOf(t);
  return r = e === -1 ? t : "-" + r.slice(0, e) + "-" + t, r.toLowerCase();
}
function jI(r, t) {
  var e = r.currentStyle || document.defaultView && document.defaultView.getComputedStyle(r);
  return e ? e[t] : null;
}
var tL = m_(JI, "transition"), lv = m_(y_, "transform"), eL = "position:absolute;display:block;border-style:solid;white-space:nowrap;z-index:9999999;" + (Y.transform3dSupported ? "will-change:transform;" : "");
function rL(r) {
  return r = r === "left" ? "right" : r === "right" ? "left" : r === "top" ? "bottom" : "top", r;
}
function iL(r, t, e) {
  if (!V(e) || e === "inside")
    return "";
  var i = r.get("backgroundColor"), n = r.get("borderWidth");
  t = di(t);
  var a = rL(e), o = Math.max(Math.round(n) * 1.5, 6), s = "", l = lv + ":", u;
  nt(["left", "right"], a) > -1 ? (s += "top:50%", l += "translateY(-50%) rotate(" + (u = a === "left" ? -225 : -45) + "deg)") : (s += "left:50%", l += "translateX(-50%) rotate(" + (u = a === "top" ? 225 : 45) + "deg)");
  var f = u * Math.PI / 180, h = o + n, c = h * Math.abs(Math.cos(f)) + h * Math.abs(Math.sin(f)), v = Math.round(((c - Math.SQRT2 * n) / 2 + Math.SQRT2 * n - (c - h) / 2) * 100) / 100;
  s += ";" + a + ":-" + v + "px";
  var p = t + " solid " + n + "px;", g = ["position:absolute;width:" + o + "px;height:" + o + "px;z-index:-1;", s + ";" + l + ";", "border-bottom:" + p, "border-right:" + p, "background-color:" + i + ";"];
  return '<div style="' + g.join("") + '"></div>';
}
function nL(r, t) {
  var e = "cubic-bezier(0.23,1,0.32,1)", i = " " + r / 2 + "s " + e, n = "opacity" + i + ",visibility" + i;
  return t || (i = " " + r + "s " + e, n += Y.transformSupported ? "," + lv + i : ",left" + i + ",top" + i), tL + ":" + n;
}
function Wd(r, t, e) {
  var i = r.toFixed(0) + "px", n = t.toFixed(0) + "px";
  if (!Y.transformSupported)
    return e ? "top:" + n + ";left:" + i + ";" : [["top", n], ["left", i]];
  var a = Y.transform3dSupported, o = "translate" + (a ? "3d" : "") + "(" + i + "," + n + (a ? ",0" : "") + ")";
  return e ? "top:0;left:0;" + lv + ":" + o + ";" : [["top", 0], ["left", 0], [y_, o]];
}
function aL(r) {
  var t = [], e = r.get("fontSize"), i = r.getTextColor();
  i && t.push("color:" + i), t.push("font:" + r.getFont());
  var n = Z(r.get("lineHeight"), Math.round(e * 3 / 2));
  e && t.push("line-height:" + n + "px");
  var a = r.get("textShadowColor"), o = r.get("textShadowBlur") || 0, s = r.get("textShadowOffsetX") || 0, l = r.get("textShadowOffsetY") || 0;
  return a && o && t.push("text-shadow:" + s + "px " + l + "px " + o + "px " + a), T(["decoration", "align"], function(u) {
    var f = r.get(u);
    f && t.push("text-" + u + ":" + f);
  }), t.join(";");
}
function oL(r, t, e) {
  var i = [], n = r.get("transitionDuration"), a = r.get("backgroundColor"), o = r.get("shadowBlur"), s = r.get("shadowColor"), l = r.get("shadowOffsetX"), u = r.get("shadowOffsetY"), f = r.getModel("textStyle"), h = Im(r, "html"), c = l + "px " + u + "px " + o + "px " + s;
  return i.push("box-shadow:" + c), t && n && i.push(nL(n, e)), a && i.push("background-color:" + a), T(["width", "color", "radius"], function(v) {
    var p = "border-" + v, g = Lh(p), d = r.get(g);
    d != null && i.push(p + ":" + d + (v === "color" ? "" : "px"));
  }), i.push(aL(f)), h != null && i.push("padding:" + an(h).join("px ") + "px"), i.join(";") + ";";
}
function Ud(r, t, e, i, n) {
  var a = t && t.painter;
  if (e) {
    var o = a && a.getViewportRoot();
    o && l1(r, o, e, i, n);
  } else {
    r[0] = i, r[1] = n;
    var s = a && a.getViewportRootOffset();
    s && (r[0] += s.offsetLeft, r[1] += s.offsetTop);
  }
  r[2] = r[0] / t.getWidth(), r[3] = r[1] / t.getHeight();
}
var sL = (
  /** @class */
  (function() {
    function r(t, e) {
      if (this._show = !1, this._styleCoord = [0, 0, 0, 0], this._enterable = !0, this._alwaysShowContent = !1, this._firstShow = !0, this._longHide = !0, Y.wxa)
        return null;
      var i = document.createElement("div");
      i.domBelongToZr = !0, this.el = i;
      var n = this._zr = t.getZr(), a = e.appendTo, o = a && (V(a) ? document.querySelector(a) : Qi(a) ? a : X(a) && a(t.getDom()));
      Ud(this._styleCoord, n, o, t.getWidth() / 2, t.getHeight() / 2), (o || t.getDom()).appendChild(i), this._api = t, this._container = o;
      var s = this;
      i.onmouseenter = function() {
        s._enterable && (clearTimeout(s._hideTimeout), s._show = !0), s._inContent = !0;
      }, i.onmousemove = function(l) {
        if (l = l || window.event, !s._enterable) {
          var u = n.handler, f = n.painter.getViewportRoot();
          se(f, l, !0), u.dispatch("mousemove", l);
        }
      }, i.onmouseleave = function() {
        s._inContent = !1, s._enterable && s._show && s.hideLater(s._hideDelay);
      };
    }
    return r.prototype.update = function(t) {
      if (!this._container) {
        var e = this._api.getDom(), i = jI(e, "position"), n = e.style;
        n.position !== "absolute" && i !== "absolute" && (n.position = "relative");
      }
      var a = t.get("alwaysShowContent");
      a && this._moveIfResized(), this._alwaysShowContent = a, this.el.className = t.get("className") || "";
    }, r.prototype.show = function(t, e) {
      clearTimeout(this._hideTimeout), clearTimeout(this._longHideTimeout);
      var i = this.el, n = i.style, a = this._styleCoord;
      i.innerHTML ? n.cssText = eL + oL(t, !this._firstShow, this._longHide) + Wd(a[0], a[1], !0) + ("border-color:" + di(e) + ";") + (t.get("extraCssText") || "") + (";pointer-events:" + (this._enterable ? "auto" : "none")) : n.display = "none", this._show = !0, this._firstShow = !1, this._longHide = !1;
    }, r.prototype.setContent = function(t, e, i, n, a) {
      var o = this.el;
      if (t == null) {
        o.innerHTML = "";
        return;
      }
      var s = "";
      if (V(a) && i.get("trigger") === "item" && !d_(i) && (s = iL(i, n, a)), V(t))
        o.innerHTML = t + s;
      else if (t) {
        o.innerHTML = "", O(t) || (t = [t]);
        for (var l = 0; l < t.length; l++)
          Qi(t[l]) && t[l].parentNode !== o && o.appendChild(t[l]);
        if (s && o.childNodes.length) {
          var u = document.createElement("div");
          u.innerHTML = s, o.appendChild(u);
        }
      }
    }, r.prototype.setEnterable = function(t) {
      this._enterable = t;
    }, r.prototype.getSize = function() {
      var t = this.el;
      return t ? [t.offsetWidth, t.offsetHeight] : [0, 0];
    }, r.prototype.moveTo = function(t, e) {
      if (this.el) {
        var i = this._styleCoord;
        if (Ud(i, this._zr, this._container, t, e), i[0] != null && i[1] != null) {
          var n = this.el.style, a = Wd(i[0], i[1]);
          T(a, function(o) {
            n[o[0]] = o[1];
          });
        }
      }
    }, r.prototype._moveIfResized = function() {
      var t = this._styleCoord[2], e = this._styleCoord[3];
      this.moveTo(t * this._zr.getWidth(), e * this._zr.getHeight());
    }, r.prototype.hide = function() {
      var t = this, e = this.el.style;
      e.visibility = "hidden", e.opacity = "0", Y.transform3dSupported && (e.willChange = ""), this._show = !1, this._longHideTimeout = setTimeout(function() {
        return t._longHide = !0;
      }, 500);
    }, r.prototype.hideLater = function(t) {
      this._show && !(this._inContent && this._enterable) && !this._alwaysShowContent && (t ? (this._hideDelay = t, this._show = !1, this._hideTimeout = setTimeout(Q(this.hide, this), t)) : this.hide());
    }, r.prototype.isShow = function() {
      return this._show;
    }, r.prototype.dispose = function() {
      clearTimeout(this._hideTimeout), clearTimeout(this._longHideTimeout);
      var t = this.el.parentNode;
      t && t.removeChild(this.el), this.el = this._container = null;
    }, r;
  })()
), lL = (
  /** @class */
  (function() {
    function r(t) {
      this._show = !1, this._styleCoord = [0, 0, 0, 0], this._alwaysShowContent = !1, this._enterable = !0, this._zr = t.getZr(), Xd(this._styleCoord, this._zr, t.getWidth() / 2, t.getHeight() / 2);
    }
    return r.prototype.update = function(t) {
      var e = t.get("alwaysShowContent");
      e && this._moveIfResized(), this._alwaysShowContent = e;
    }, r.prototype.show = function() {
      this._hideTimeout && clearTimeout(this._hideTimeout), this.el.show(), this._show = !0;
    }, r.prototype.setContent = function(t, e, i, n, a) {
      var o = this;
      H(t) && Zt(""), this.el && this._zr.remove(this.el);
      var s = i.getModel("textStyle");
      this.el = new mt({
        style: {
          rich: e.richTextStyles,
          text: t,
          lineHeight: 22,
          borderWidth: 1,
          borderColor: n,
          textShadowColor: s.get("textShadowColor"),
          fill: i.get(["textStyle", "color"]),
          padding: Im(i, "richText"),
          verticalAlign: "top",
          align: "left"
        },
        z: i.get("z")
      }), T(["backgroundColor", "borderRadius", "shadowColor", "shadowBlur", "shadowOffsetX", "shadowOffsetY"], function(u) {
        o.el.style[u] = i.get(u);
      }), T(["textShadowBlur", "textShadowOffsetX", "textShadowOffsetY"], function(u) {
        o.el.style[u] = s.get(u) || 0;
      }), this._zr.add(this.el);
      var l = this;
      this.el.on("mouseover", function() {
        l._enterable && (clearTimeout(l._hideTimeout), l._show = !0), l._inContent = !0;
      }), this.el.on("mouseout", function() {
        l._enterable && l._show && l.hideLater(l._hideDelay), l._inContent = !1;
      });
    }, r.prototype.setEnterable = function(t) {
      this._enterable = t;
    }, r.prototype.getSize = function() {
      var t = this.el, e = this.el.getBoundingRect(), i = Yd(t.style);
      return [e.width + i.left + i.right, e.height + i.top + i.bottom];
    }, r.prototype.moveTo = function(t, e) {
      var i = this.el;
      if (i) {
        var n = this._styleCoord;
        Xd(n, this._zr, t, e), t = n[0], e = n[1];
        var a = i.style, o = pr(a.borderWidth || 0), s = Yd(a);
        i.x = t + o + s.left, i.y = e + o + s.top, i.markRedraw();
      }
    }, r.prototype._moveIfResized = function() {
      var t = this._styleCoord[2], e = this._styleCoord[3];
      this.moveTo(t * this._zr.getWidth(), e * this._zr.getHeight());
    }, r.prototype.hide = function() {
      this.el && this.el.hide(), this._show = !1;
    }, r.prototype.hideLater = function(t) {
      this._show && !(this._inContent && this._enterable) && !this._alwaysShowContent && (t ? (this._hideDelay = t, this._show = !1, this._hideTimeout = setTimeout(Q(this.hide, this), t)) : this.hide());
    }, r.prototype.isShow = function() {
      return this._show;
    }, r.prototype.dispose = function() {
      this._zr.remove(this.el);
    }, r;
  })()
);
function pr(r) {
  return Math.max(0, r);
}
function Yd(r) {
  var t = pr(r.shadowBlur || 0), e = pr(r.shadowOffsetX || 0), i = pr(r.shadowOffsetY || 0);
  return {
    left: pr(t - e),
    right: pr(t + e),
    top: pr(t - i),
    bottom: pr(t + i)
  };
}
function Xd(r, t, e, i) {
  r[0] = e, r[1] = i, r[2] = r[0] / t.getWidth(), r[3] = r[1] / t.getHeight();
}
var uL = new dt({
  shape: {
    x: -1,
    y: -1,
    width: 2,
    height: 2
  }
}), fL = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e;
    }
    return t.prototype.init = function(e, i) {
      if (!(Y.node || !i.getDom())) {
        var n = e.getComponent("tooltip"), a = this._renderMode = YS(n.get("renderMode"));
        this._tooltipContent = a === "richText" ? new lL(i) : new sL(i, {
          appendTo: n.get("appendToBody", !0) ? "body" : n.get("appendTo", !0)
        });
      }
    }, t.prototype.render = function(e, i, n) {
      if (!(Y.node || !n.getDom())) {
        this.group.removeAll(), this._tooltipModel = e, this._ecModel = i, this._api = n;
        var a = this._tooltipContent;
        a.update(e), a.setEnterable(e.get("enterable")), this._initGlobalListener(), this._keepShow(), this._renderMode !== "richText" && e.get("transitionDuration") ? Pm(this, "_updatePosition", 50, "fixRate") : mf(this, "_updatePosition");
      }
    }, t.prototype._initGlobalListener = function() {
      var e = this._tooltipModel, i = e.get("triggerOn");
      v_("itemTooltip", this._api, Q(function(n, a, o) {
        i !== "none" && (i.indexOf(n) >= 0 ? this._tryShow(a, o) : n === "leave" && this._hide(o));
      }, this));
    }, t.prototype._keepShow = function() {
      var e = this._tooltipModel, i = this._ecModel, n = this._api, a = e.get("triggerOn");
      if (this._lastX != null && this._lastY != null && a !== "none" && a !== "click") {
        var o = this;
        clearTimeout(this._refreshUpdateTimeout), this._refreshUpdateTimeout = setTimeout(function() {
          !n.isDisposed() && o.manuallyShowTip(e, i, n, {
            x: o._lastX,
            y: o._lastY,
            dataByCoordSys: o._lastDataByCoordSys
          });
        });
      }
    }, t.prototype.manuallyShowTip = function(e, i, n, a) {
      if (!(a.from === this.uid || Y.node || !n.getDom())) {
        var o = $d(a, n);
        this._ticket = "";
        var s = a.dataByCoordSys, l = pL(a, i, n);
        if (l) {
          var u = l.el.getBoundingRect().clone();
          u.applyTransform(l.el.transform), this._tryShow({
            offsetX: u.x + u.width / 2,
            offsetY: u.y + u.height / 2,
            target: l.el,
            position: a.position,
            // When manully trigger, the mouse is not on the el, so we'd better to
            // position tooltip on the bottom of the el and display arrow is possible.
            positionDefault: "bottom"
          }, o);
        } else if (a.tooltip && a.x != null && a.y != null) {
          var f = uL;
          f.x = a.x, f.y = a.y, f.update(), J(f).tooltipConfig = {
            name: null,
            option: a.tooltip
          }, this._tryShow({
            offsetX: a.x,
            offsetY: a.y,
            target: f
          }, o);
        } else if (s)
          this._tryShow({
            offsetX: a.x,
            offsetY: a.y,
            position: a.position,
            dataByCoordSys: s,
            tooltipOption: a.tooltipOption
          }, o);
        else if (a.seriesIndex != null) {
          if (this._manuallyAxisShowTip(e, i, n, a))
            return;
          var h = c_(a, i), c = h.point[0], v = h.point[1];
          c != null && v != null && this._tryShow({
            offsetX: c,
            offsetY: v,
            target: h.el,
            position: a.position,
            // When manully trigger, the mouse is not on the el, so we'd better to
            // position tooltip on the bottom of the el and display arrow is possible.
            positionDefault: "bottom"
          }, o);
        } else a.x != null && a.y != null && (n.dispatchAction({
          type: "updateAxisPointer",
          x: a.x,
          y: a.y
        }), this._tryShow({
          offsetX: a.x,
          offsetY: a.y,
          position: a.position,
          target: n.getZr().findHover(a.x, a.y).target
        }, o));
      }
    }, t.prototype.manuallyHideTip = function(e, i, n, a) {
      var o = this._tooltipContent;
      this._tooltipModel && o.hideLater(this._tooltipModel.get("hideDelay")), this._lastX = this._lastY = this._lastDataByCoordSys = null, a.from !== this.uid && this._hide($d(a, n));
    }, t.prototype._manuallyAxisShowTip = function(e, i, n, a) {
      var o = a.seriesIndex, s = a.dataIndex, l = i.getComponent("axisPointer").coordSysAxesInfo;
      if (!(o == null || s == null || l == null)) {
        var u = i.getSeriesByIndex(o);
        if (u) {
          var f = u.getData(), h = In([f.getItemModel(s), u, (u.coordinateSystem || {}).model], this._tooltipModel);
          if (h.get("trigger") === "axis")
            return n.dispatchAction({
              type: "updateAxisPointer",
              seriesIndex: o,
              dataIndex: s,
              position: a.position
            }), !0;
        }
      }
    }, t.prototype._tryShow = function(e, i) {
      var n = e.target, a = this._tooltipModel;
      if (a) {
        this._lastX = e.offsetX, this._lastY = e.offsetY;
        var o = e.dataByCoordSys;
        if (o && o.length)
          this._showAxisTooltip(o, e);
        else if (n) {
          var s = J(n);
          if (s.ssrType === "legend")
            return;
          this._lastDataByCoordSys = null;
          var l, u;
          Gi(n, function(f) {
            if (J(f).dataIndex != null)
              return l = f, !0;
            if (J(f).tooltipConfig != null)
              return u = f, !0;
          }, !0), l ? this._showSeriesItemTooltip(e, l, i) : u ? this._showComponentItemTooltip(e, u, i) : this._hide(i);
        } else
          this._lastDataByCoordSys = null, this._hide(i);
      }
    }, t.prototype._showOrMove = function(e, i) {
      var n = e.get("showDelay");
      i = Q(i, this), clearTimeout(this._showTimout), n > 0 ? this._showTimout = setTimeout(i, n) : i();
    }, t.prototype._showAxisTooltip = function(e, i) {
      var n = this._ecModel, a = this._tooltipModel, o = [i.offsetX, i.offsetY], s = In([i.tooltipOption], a), l = this._renderMode, u = [], f = gi("section", {
        blocks: [],
        noHeader: !0
      }), h = [], c = new Zl();
      T(e, function(m) {
        T(m.dataByAxis, function(_) {
          var S = n.getComponent(_.axisDim + "Axis", _.axisIndex), w = _.value;
          if (!(!S || w == null)) {
            var b = f_(w, S.axis, n, _.seriesDataIndices, _.valueLabelOpt), x = gi("section", {
              header: b,
              noHeader: !Me(b),
              sortBlocks: !0,
              blocks: []
            });
            f.blocks.push(x), T(_.seriesDataIndices, function(M) {
              var D = n.getSeriesByIndex(M.seriesIndex), A = M.dataIndexInside, C = D.getDataParams(A);
              if (!(C.dataIndex < 0)) {
                C.axisDim = _.axisDim, C.axisIndex = _.axisIndex, C.axisType = _.axisType, C.axisId = _.axisId, C.axisValue = ev(S.axis, {
                  value: w
                }), C.axisValueLabel = b, C.marker = c.makeTooltipMarker("item", di(C.color), l);
                var I = Qc(D.formatTooltip(A, !0, null)), L = I.frag;
                if (L) {
                  var P = In([D], a).get("valueFormatter");
                  x.blocks.push(P ? k({
                    valueFormatter: P
                  }, L) : L);
                }
                I.text && h.push(I.text), u.push(C);
              }
            });
          }
        });
      }), f.blocks.reverse(), h.reverse();
      var v = i.position, p = s.get("order"), g = rp(f, c, l, p, n.get("useUTC"), s.get("textStyle"));
      g && h.unshift(g);
      var d = l === "richText" ? `

` : "<br/>", y = h.join(d);
      this._showOrMove(s, function() {
        this._updateContentNotChangedOnAxis(e, u) ? this._updatePosition(s, v, o[0], o[1], this._tooltipContent, u) : this._showTooltipContent(s, y, u, Math.random() + "", o[0], o[1], v, null, c);
      });
    }, t.prototype._showSeriesItemTooltip = function(e, i, n) {
      var a = this._ecModel, o = J(i), s = o.seriesIndex, l = a.getSeriesByIndex(s), u = o.dataModel || l, f = o.dataIndex, h = o.dataType, c = u.getData(h), v = this._renderMode, p = e.positionDefault, g = In([c.getItemModel(f), u, l && (l.coordinateSystem || {}).model], this._tooltipModel, p ? {
        position: p
      } : null), d = g.get("trigger");
      if (!(d != null && d !== "item")) {
        var y = u.getDataParams(f, h), m = new Zl();
        y.marker = m.makeTooltipMarker("item", di(y.color), v);
        var _ = Qc(u.formatTooltip(f, !1, h)), S = g.get("order"), w = g.get("valueFormatter"), b = _.frag, x = b ? rp(w ? k({
          valueFormatter: w
        }, b) : b, m, v, S, a.get("useUTC"), g.get("textStyle")) : _.text, M = "item_" + u.name + "_" + f;
        this._showOrMove(g, function() {
          this._showTooltipContent(g, x, y, M, e.offsetX, e.offsetY, e.position, e.target, m);
        }), n({
          type: "showTip",
          dataIndexInside: f,
          dataIndex: c.getRawIndex(f),
          seriesIndex: s,
          from: this.uid
        });
      }
    }, t.prototype._showComponentItemTooltip = function(e, i, n) {
      var a = this._renderMode === "html", o = J(i), s = o.tooltipConfig, l = s.option || {}, u = l.encodeHTMLContent;
      if (V(l)) {
        var f = l;
        l = {
          content: f,
          // Fixed formatter
          formatter: f
        }, u = !0;
      }
      u && a && l.content && (l = U(l), l.content = Ft(l.content));
      var h = [l], c = this._ecModel.getComponent(o.componentMainType, o.componentIndex);
      c && h.push(c), h.push({
        formatter: l.content
      });
      var v = e.positionDefault, p = In(h, this._tooltipModel, v ? {
        position: v
      } : null), g = p.get("content"), d = Math.random() + "", y = new Zl();
      this._showOrMove(p, function() {
        var m = U(p.get("formatterParams") || {});
        this._showTooltipContent(p, g, m, d, e.offsetX, e.offsetY, e.position, i, y);
      }), n({
        type: "showTip",
        from: this.uid
      });
    }, t.prototype._showTooltipContent = function(e, i, n, a, o, s, l, u, f) {
      if (this._ticket = "", !(!e.get("showContent") || !e.get("show"))) {
        var h = this._tooltipContent;
        h.setEnterable(e.get("enterable"));
        var c = e.get("formatter");
        l = l || e.get("position");
        var v = i, p = this._getNearestPoint([o, s], n, e.get("trigger"), e.get("borderColor")), g = p.color;
        if (c)
          if (V(c)) {
            var d = e.ecModel.get("useUTC"), y = O(n) ? n[0] : n, m = y && y.axisType && y.axisType.indexOf("time") >= 0;
            v = c, m && (v = Pa(y.axisValue, v, d)), v = Ph(v, n, !0);
          } else if (X(c)) {
            var _ = Q(function(S, w) {
              S === this._ticket && (h.setContent(w, f, e, g, l), this._updatePosition(e, l, o, s, h, n, u));
            }, this);
            this._ticket = a, v = c(n, a, _);
          } else
            v = c;
        h.setContent(v, f, e, g, l), h.show(e, g), this._updatePosition(e, l, o, s, h, n, u);
      }
    }, t.prototype._getNearestPoint = function(e, i, n, a) {
      if (n === "axis" || O(i))
        return {
          color: a || (this._renderMode === "html" ? "#fff" : "none")
        };
      if (!O(i))
        return {
          color: a || i.color || i.borderColor
        };
    }, t.prototype._updatePosition = function(e, i, n, a, o, s, l) {
      var u = this._api.getWidth(), f = this._api.getHeight();
      i = i || e.get("position");
      var h = o.getSize(), c = e.get("align"), v = e.get("verticalAlign"), p = l && l.getBoundingRect().clone();
      if (l && p.applyTransform(l.transform), X(i) && (i = i([n, a], s, o.el, p, {
        viewSize: [u, f],
        contentSize: h.slice()
      })), O(i))
        n = Mt(i[0], u), a = Mt(i[1], f);
      else if (H(i)) {
        var g = i;
        g.width = h[0], g.height = h[1];
        var d = Ar(g, {
          width: u,
          height: f
        });
        n = d.x, a = d.y, c = null, v = null;
      } else if (V(i) && l) {
        var y = cL(i, p, h, e.get("borderWidth"));
        n = y[0], a = y[1];
      } else {
        var y = hL(n, a, o, u, f, c ? null : 20, v ? null : 20);
        n = y[0], a = y[1];
      }
      if (c && (n -= Zd(c) ? h[0] / 2 : c === "right" ? h[0] : 0), v && (a -= Zd(v) ? h[1] / 2 : v === "bottom" ? h[1] : 0), d_(e)) {
        var y = vL(n, a, o, u, f);
        n = y[0], a = y[1];
      }
      o.moveTo(n, a);
    }, t.prototype._updateContentNotChangedOnAxis = function(e, i) {
      var n = this._lastDataByCoordSys, a = this._cbParamsList, o = !!n && n.length === e.length;
      return o && T(n, function(s, l) {
        var u = s.dataByAxis || [], f = e[l] || {}, h = f.dataByAxis || [];
        o = o && u.length === h.length, o && T(u, function(c, v) {
          var p = h[v] || {}, g = c.seriesDataIndices || [], d = p.seriesDataIndices || [];
          o = o && c.value === p.value && c.axisType === p.axisType && c.axisId === p.axisId && g.length === d.length, o && T(g, function(y, m) {
            var _ = d[m];
            o = o && y.seriesIndex === _.seriesIndex && y.dataIndex === _.dataIndex;
          }), a && T(c.seriesDataIndices, function(y) {
            var m = y.seriesIndex, _ = i[m], S = a[m];
            _ && S && S.data !== _.data && (o = !1);
          });
        });
      }), this._lastDataByCoordSys = e, this._cbParamsList = i, !!o;
    }, t.prototype._hide = function(e) {
      this._lastDataByCoordSys = null, e({
        type: "hideTip",
        from: this.uid
      });
    }, t.prototype.dispose = function(e, i) {
      Y.node || !i.getDom() || (mf(this, "_updatePosition"), this._tooltipContent.dispose(), Vf("itemTooltip", i));
    }, t.type = "tooltip", t;
  })(kt)
);
function In(r, t, e) {
  var i = t.ecModel, n;
  e ? (n = new pt(e, i, i), n = new pt(t.option, n, i)) : n = t;
  for (var a = r.length - 1; a >= 0; a--) {
    var o = r[a];
    o && (o instanceof pt && (o = o.get("tooltip", !0)), V(o) && (o = {
      formatter: o
    }), o && (n = new pt(o, n, i)));
  }
  return n;
}
function $d(r, t) {
  return r.dispatchAction || Q(t.dispatchAction, t);
}
function hL(r, t, e, i, n, a, o) {
  var s = e.getSize(), l = s[0], u = s[1];
  return a != null && (r + l + a + 2 > i ? r -= l + a : r += a), o != null && (t + u + o > n ? t -= u + o : t += o), [r, t];
}
function vL(r, t, e, i, n) {
  var a = e.getSize(), o = a[0], s = a[1];
  return r = Math.min(r + o, i) - o, t = Math.min(t + s, n) - s, r = Math.max(r, 0), t = Math.max(t, 0), [r, t];
}
function cL(r, t, e, i) {
  var n = e[0], a = e[1], o = Math.ceil(Math.SQRT2 * i) + 8, s = 0, l = 0, u = t.width, f = t.height;
  switch (r) {
    case "inside":
      s = t.x + u / 2 - n / 2, l = t.y + f / 2 - a / 2;
      break;
    case "top":
      s = t.x + u / 2 - n / 2, l = t.y - a - o;
      break;
    case "bottom":
      s = t.x + u / 2 - n / 2, l = t.y + f + o;
      break;
    case "left":
      s = t.x - n - o, l = t.y + f / 2 - a / 2;
      break;
    case "right":
      s = t.x + u + o, l = t.y + f / 2 - a / 2;
  }
  return [s, l];
}
function Zd(r) {
  return r === "center" || r === "middle";
}
function pL(r, t, e) {
  var i = vh(r).queryOptionMap, n = i.keys()[0];
  if (!(!n || n === "series")) {
    var a = Ca(t, n, i.get(n), {
      useDefault: !1,
      enableAll: !1,
      enableNone: !1
    }), o = a.models[0];
    if (o) {
      var s = e.getViewOfComponentModel(o), l;
      if (s.group.traverse(function(u) {
        var f = J(u).tooltipConfig;
        if (f && f.name === r.name)
          return l = u, !0;
      }), l)
        return {
          componentMainType: n,
          componentIndex: o.componentIndex,
          el: l
        };
    }
  }
}
function dL(r) {
  ye(p_), r.registerComponentModel(QI), r.registerComponentView(fL), r.registerAction({
    type: "showTip",
    event: "showTip",
    update: "tooltip:manuallyShowTip"
  }, Rt), r.registerAction({
    type: "hideTip",
    event: "hideTip",
    update: "tooltip:manuallyHideTip"
  }, Rt);
}
var qd = T;
function Kd(r) {
  if (r) {
    for (var t in r)
      if (r.hasOwnProperty(t))
        return !0;
  }
}
function Qd(r, t, e) {
  var i = {};
  return qd(t, function(a) {
    var o = i[a] = n();
    qd(r[a], function(s, l) {
      if (Ot.isValidType(l)) {
        var u = {
          type: l,
          visual: s
        };
        e && e(u, a), o[l] = new Ot(u), l === "opacity" && (u = U(u), u.type = "colorAlpha", o.__hidden.__alphaForOpacity = new Ot(u));
      }
    });
  }), i;
  function n() {
    var a = function() {
    };
    a.prototype.__hidden = a.prototype;
    var o = new a();
    return o;
  }
}
function gL(r, t, e) {
  var i;
  T(e, function(n) {
    t.hasOwnProperty(n) && Kd(t[n]) && (i = !0);
  }), i && T(e, function(n) {
    t.hasOwnProperty(n) && Kd(t[n]) ? r[n] = U(t[n]) : delete r[n];
  });
}
function yL(r, t, e, i) {
  var n = {};
  return T(r, function(a) {
    var o = Ot.prepareVisualTypes(t[a]);
    n[a] = o;
  }), {
    progress: function(o, s) {
      var l;
      i != null && (l = s.getDimensionIndex(i));
      function u(w) {
        return Fm(s, h, w);
      }
      function f(w, b) {
        oC(s, h, w, b);
      }
      for (var h, c = s.getStore(); (h = o.next()) != null; ) {
        var v = s.getRawDataItem(h);
        if (!(v && v.visualMap === !1))
          for (var p = i != null ? c.get(l, h) : h, g = e(p), d = t[g], y = n[g], m = 0, _ = y.length; m < _; m++) {
            var S = y[m];
            d[S] && d[S].applyVisual(p, u, f);
          }
      }
    }
  };
}
var mL = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e.layoutMode = {
        type: "box",
        ignoreSize: !0
      }, e;
    }
    return t.type = "title", t.defaultOption = {
      // zlevel: 0,
      z: 6,
      show: !0,
      text: "",
      target: "blank",
      subtext: "",
      subtarget: "blank",
      left: 0,
      top: 0,
      backgroundColor: "rgba(0,0,0,0)",
      borderColor: "#ccc",
      borderWidth: 0,
      padding: 5,
      itemGap: 10,
      textStyle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#464646"
      },
      subtextStyle: {
        fontSize: 12,
        color: "#6E7079"
      }
    }, t;
  })(rt)
), _L = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e;
    }
    return t.prototype.render = function(e, i, n) {
      if (this.group.removeAll(), !!e.get("show")) {
        var a = this.group, o = e.getModel("textStyle"), s = e.getModel("subtextStyle"), l = e.get("textAlign"), u = Z(e.get("textBaseline"), e.get("textVerticalAlign")), f = new mt({
          style: re(o, {
            text: e.get("text"),
            fill: o.getTextColor()
          }, {
            disableBox: !0
          }),
          z2: 10
        }), h = f.getBoundingRect(), c = e.get("subtext"), v = new mt({
          style: re(s, {
            text: c,
            fill: s.getTextColor(),
            y: h.height + e.get("itemGap"),
            verticalAlign: "top"
          }, {
            disableBox: !0
          }),
          z2: 10
        }), p = e.get("link"), g = e.get("sublink"), d = e.get("triggerEvent", !0);
        f.silent = !p && !d, v.silent = !g && !d, p && f.on("click", function() {
          Ec(p, "_" + e.get("target"));
        }), g && v.on("click", function() {
          Ec(g, "_" + e.get("subtarget"));
        }), J(f).eventData = J(v).eventData = d ? {
          componentType: "title",
          componentIndex: e.componentIndex
        } : null, a.add(f), c && a.add(v);
        var y = a.getBoundingRect(), m = e.getBoxLayoutParams();
        m.width = y.width, m.height = y.height;
        var _ = Ar(m, {
          width: n.getWidth(),
          height: n.getHeight()
        }, e.get("padding"));
        l || (l = e.get("left") || e.get("right"), l === "middle" && (l = "center"), l === "right" ? _.x += _.width : l === "center" && (_.x += _.width / 2)), u || (u = e.get("top") || e.get("bottom"), u === "center" && (u = "middle"), u === "bottom" ? _.y += _.height : u === "middle" && (_.y += _.height / 2), u = u || "top"), a.x = _.x, a.y = _.y, a.markRedraw();
        var S = {
          align: l,
          verticalAlign: u
        };
        f.setStyle(S), v.setStyle(S), y = a.getBoundingRect();
        var w = _.margin, b = e.getItemStyle(["color", "opacity"]);
        b.fill = e.get("backgroundColor");
        var x = new dt({
          shape: {
            x: y.x - w[3],
            y: y.y - w[0],
            width: y.width + w[1] + w[3],
            height: y.height + w[0] + w[2],
            r: e.get("borderRadius")
          },
          style: b,
          subPixelOptimize: !0,
          silent: !0
        });
        a.add(x);
      }
    }, t.type = "title", t;
  })(kt)
);
function SL(r) {
  r.registerComponentModel(mL), r.registerComponentView(_L);
}
function bL(r, t) {
  if (!r)
    return !1;
  for (var e = O(r) ? r : [r], i = 0; i < e.length; i++)
    if (e[i] && e[i][t])
      return !0;
  return !1;
}
function bo(r) {
  ju(r, "label", ["show"]);
}
var wo = bt(), ma = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e.createdBySelf = !1, e;
    }
    return t.prototype.init = function(e, i, n) {
      this.mergeDefaultAndTheme(e, n), this._mergeOption(e, n, !1, !0);
    }, t.prototype.isAnimationEnabled = function() {
      if (Y.node)
        return !1;
      var e = this.__hostSeries;
      return this.getShallow("animation") && e && e.isAnimationEnabled();
    }, t.prototype.mergeOption = function(e, i) {
      this._mergeOption(e, i, !1, !1);
    }, t.prototype._mergeOption = function(e, i, n, a) {
      var o = this.mainType;
      n || i.eachSeries(function(s) {
        var l = s.get(this.mainType, !0), u = wo(s)[o];
        if (!l || !l.data) {
          wo(s)[o] = null;
          return;
        }
        u ? u._mergeOption(l, i, !0) : (a && bo(l), T(l.data, function(f) {
          f instanceof Array ? (bo(f[0]), bo(f[1])) : bo(f);
        }), u = this.createMarkerModelFromSeries(l, this, i), k(u, {
          mainType: this.mainType,
          // Use the same series index and name
          seriesIndex: s.seriesIndex,
          name: s.name,
          createdBySelf: !0
        }), u.__hostSeries = s), wo(s)[o] = u;
      }, this);
    }, t.prototype.formatTooltip = function(e, i, n) {
      var a = this.getData(), o = this.getRawValue(e), s = a.getName(e);
      return gi("section", {
        header: this.name,
        blocks: [gi("nameValue", {
          name: s,
          value: o,
          noName: !s,
          noValue: o == null
        })]
      });
    }, t.prototype.getData = function() {
      return this._data;
    }, t.prototype.setData = function(e) {
      this._data = e;
    }, t.prototype.getDataParams = function(e, i) {
      var n = Bh.prototype.getDataParams.call(this, e, i), a = this.__hostSeries;
      return a && (n.seriesId = a.id, n.seriesName = a.name, n.seriesType = a.subType), n;
    }, t.getMarkerModelFromSeries = function(e, i) {
      return wo(e)[i];
    }, t.type = "marker", t.dependencies = ["series", "grid", "polar", "geo"], t;
  })(rt)
);
ie(ma, Bh.prototype);
function wL(r) {
  return !(isNaN(parseFloat(r.x)) && isNaN(parseFloat(r.y)));
}
function xL(r) {
  return !isNaN(parseFloat(r.x)) && !isNaN(parseFloat(r.y));
}
function xo(r, t, e, i, n, a) {
  var o = [], s = Ir(
    t,
    i
    /* , otherDataDim */
  ), l = s ? t.getCalculationInfo("stackResultDimension") : i, u = uv(t, l, r), f = t.indicesOfNearest(l, u)[0];
  o[n] = t.get(e, f), o[a] = t.get(l, f);
  var h = t.get(i, f), c = De(t.get(i, f));
  return c = Math.min(c, 20), c >= 0 && (o[a] = +o[a].toFixed(c)), [o, h];
}
var Tu = {
  min: ht(xo, "min"),
  max: ht(xo, "max"),
  average: ht(xo, "average"),
  median: ht(xo, "median")
};
function Jd(r, t) {
  if (t) {
    var e = r.getData(), i = r.coordinateSystem, n = i && i.dimensions;
    if (!xL(t) && !O(t.coord) && O(n)) {
      var a = __(t, e, i, r);
      if (t = U(t), t.type && Tu[t.type] && a.baseAxis && a.valueAxis) {
        var o = nt(n, a.baseAxis.dim), s = nt(n, a.valueAxis.dim), l = Tu[t.type](e, a.baseDataDim, a.valueDataDim, o, s);
        t.coord = l[0], t.value = l[1];
      } else
        t.coord = [t.xAxis != null ? t.xAxis : t.radiusAxis, t.yAxis != null ? t.yAxis : t.angleAxis];
    }
    if (t.coord == null || !O(n))
      t.coord = [];
    else
      for (var u = t.coord, f = 0; f < 2; f++)
        Tu[u[f]] && (u[f] = uv(e, e.mapDimension(n[f]), u[f]));
    return t;
  }
}
function __(r, t, e, i) {
  var n = {};
  return r.valueIndex != null || r.valueDim != null ? (n.valueDataDim = r.valueIndex != null ? t.getDimension(r.valueIndex) : r.valueDim, n.valueAxis = e.getAxis(TL(i, n.valueDataDim)), n.baseAxis = e.getOtherAxis(n.valueAxis), n.baseDataDim = t.mapDimension(n.baseAxis.dim)) : (n.baseAxis = i.getBaseAxis(), n.valueAxis = e.getOtherAxis(n.baseAxis), n.baseDataDim = t.mapDimension(n.baseAxis.dim), n.valueDataDim = t.mapDimension(n.valueAxis.dim)), n;
}
function TL(r, t) {
  var e = r.getData().getDimensionInfo(t);
  return e && e.coordDim;
}
function jd(r, t) {
  return r && r.containData && t.coord && !wL(t) ? r.containData(t.coord) : !0;
}
function CL(r, t) {
  return r ? function(e, i, n, a) {
    var o = a < 2 ? e.coord && e.coord[a] : e.value;
    return Ki(o, t[a]);
  } : function(e, i, n, a) {
    return Ki(e.value, t[a]);
  };
}
function uv(r, t, e) {
  if (e === "average") {
    var i = 0, n = 0;
    return r.each(t, function(a, o) {
      isNaN(a) || (i += a, n++);
    }), i / n;
  } else return e === "median" ? r.getMedian(t) : r.getDataExtent(t)[e === "max" ? 1 : 0];
}
var Cu = bt(), ML = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e;
    }
    return t.prototype.init = function() {
      this.markerGroupMap = q();
    }, t.prototype.render = function(e, i, n) {
      var a = this, o = this.markerGroupMap;
      o.each(function(s) {
        Cu(s).keep = !1;
      }), i.eachSeries(function(s) {
        var l = ma.getMarkerModelFromSeries(s, a.type);
        l && a.renderSeries(s, l, i, n);
      }), o.each(function(s) {
        !Cu(s).keep && a.group.remove(s.group);
      });
    }, t.prototype.markKeep = function(e) {
      Cu(e).keep = !0;
    }, t.prototype.toggleBlurSeries = function(e, i) {
      var n = this;
      T(e, function(a) {
        var o = ma.getMarkerModelFromSeries(a, n.type);
        if (o) {
          var s = o.getData();
          s.eachItemGraphicEl(function(l) {
            l && (i ? wy(l) : yh(l));
          });
        }
      });
    }, t.type = "marker", t;
  })(kt)
), DL = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e;
    }
    return t.prototype.createMarkerModelFromSeries = function(e, i, n) {
      return new t(e, i, n);
    }, t.type = "markLine", t.defaultOption = {
      // zlevel: 0,
      z: 5,
      symbol: ["circle", "arrow"],
      symbolSize: [8, 16],
      // symbolRotate: 0,
      symbolOffset: 0,
      precision: 2,
      tooltip: {
        trigger: "item"
      },
      label: {
        show: !0,
        position: "end",
        distance: 5
      },
      lineStyle: {
        type: "dashed"
      },
      emphasis: {
        label: {
          show: !0
        },
        lineStyle: {
          width: 3
        }
      },
      animationEasing: "linear"
    }, t;
  })(ma)
), To = bt(), AL = function(r, t, e, i) {
  var n = r.getData(), a;
  if (O(i))
    a = i;
  else {
    var o = i.type;
    if (o === "min" || o === "max" || o === "average" || o === "median" || i.xAxis != null || i.yAxis != null) {
      var s = void 0, l = void 0;
      if (i.yAxis != null || i.xAxis != null)
        s = t.getAxis(i.yAxis != null ? "y" : "x"), l = Cr(i.yAxis, i.xAxis);
      else {
        var u = __(i, n, t, r);
        s = u.valueAxis;
        var f = Qh(n, u.valueDataDim);
        l = uv(n, f, o);
      }
      var h = s.dim === "x" ? 0 : 1, c = 1 - h, v = U(i), p = {
        coord: []
      };
      v.type = null, v.coord = [], v.coord[c] = -1 / 0, p.coord[c] = 1 / 0;
      var g = e.get("precision");
      g >= 0 && vt(l) && (l = +l.toFixed(Math.min(g, 20))), v.coord[h] = p.coord[h] = l, a = [v, p, {
        type: o,
        valueIndex: i.valueIndex,
        // Force to use the value of calculated value.
        value: l
      }];
    } else
      a = [];
  }
  var d = [Jd(r, a[0]), Jd(r, a[1]), k({}, a[2])];
  return d[2].type = d[2].type || null, j(d[2], d[0]), j(d[2], d[1]), d;
};
function ds(r) {
  return !isNaN(r) && !isFinite(r);
}
function tg(r, t, e, i) {
  var n = 1 - r, a = i.dimensions[r];
  return ds(t[n]) && ds(e[n]) && t[r] === e[r] && i.getAxis(a).containData(t[r]);
}
function IL(r, t) {
  if (r.type === "cartesian2d") {
    var e = t[0].coord, i = t[1].coord;
    if (e && i && (tg(1, e, i, r) || tg(0, e, i, r)))
      return !0;
  }
  return jd(r, t[0]) && jd(r, t[1]);
}
function Mu(r, t, e, i, n) {
  var a = i.coordinateSystem, o = r.getItemModel(t), s, l = Mt(o.get("x"), n.getWidth()), u = Mt(o.get("y"), n.getHeight());
  if (!isNaN(l) && !isNaN(u))
    s = [l, u];
  else {
    if (i.getMarkerPosition)
      s = i.getMarkerPosition(r.getValues(r.dimensions, t));
    else {
      var f = a.dimensions, h = r.get(f[0], t), c = r.get(f[1], t);
      s = a.dataToPoint([h, c]);
    }
    if (Oa(a, "cartesian2d")) {
      var v = a.getAxis("x"), p = a.getAxis("y"), f = a.dimensions;
      ds(r.get(f[0], t)) ? s[0] = v.toGlobalCoord(v.getExtent()[e ? 0 : 1]) : ds(r.get(f[1], t)) && (s[1] = p.toGlobalCoord(p.getExtent()[e ? 0 : 1]));
    }
    isNaN(l) || (s[0] = l), isNaN(u) || (s[1] = u);
  }
  r.setItemLayout(t, s);
}
var LL = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e;
    }
    return t.prototype.updateTransform = function(e, i, n) {
      i.eachSeries(function(a) {
        var o = ma.getMarkerModelFromSeries(a, "markLine");
        if (o) {
          var s = o.getData(), l = To(o).from, u = To(o).to;
          l.each(function(f) {
            Mu(l, f, !0, a, n), Mu(u, f, !1, a, n);
          }), s.each(function(f) {
            s.setItemLayout(f, [l.getItemLayout(f), u.getItemLayout(f)]);
          }), this.markerGroupMap.get(a.id).updateLayout();
        }
      }, this);
    }, t.prototype.renderSeries = function(e, i, n, a) {
      var o = e.coordinateSystem, s = e.id, l = e.getData(), u = this.markerGroupMap, f = u.get(s) || u.set(s, new dI());
      this.group.add(f.group);
      var h = PL(o, e, i), c = h.from, v = h.to, p = h.line;
      To(i).from = c, To(i).to = v, i.setData(p);
      var g = i.get("symbol"), d = i.get("symbolSize"), y = i.get("symbolRotate"), m = i.get("symbolOffset");
      O(g) || (g = [g, g]), O(d) || (d = [d, d]), O(y) || (y = [y, y]), O(m) || (m = [m, m]), h.from.each(function(S) {
        _(c, S, !0), _(v, S, !1);
      }), p.each(function(S) {
        var w = p.getItemModel(S).getModel("lineStyle").getLineStyle();
        p.setItemLayout(S, [c.getItemLayout(S), v.getItemLayout(S)]), w.stroke == null && (w.stroke = c.getItemVisual(S, "style").fill), p.setItemVisual(S, {
          fromSymbolKeepAspect: c.getItemVisual(S, "symbolKeepAspect"),
          fromSymbolOffset: c.getItemVisual(S, "symbolOffset"),
          fromSymbolRotate: c.getItemVisual(S, "symbolRotate"),
          fromSymbolSize: c.getItemVisual(S, "symbolSize"),
          fromSymbol: c.getItemVisual(S, "symbol"),
          toSymbolKeepAspect: v.getItemVisual(S, "symbolKeepAspect"),
          toSymbolOffset: v.getItemVisual(S, "symbolOffset"),
          toSymbolRotate: v.getItemVisual(S, "symbolRotate"),
          toSymbolSize: v.getItemVisual(S, "symbolSize"),
          toSymbol: v.getItemVisual(S, "symbol"),
          style: w
        });
      }), f.updateData(p), h.line.eachItemGraphicEl(function(S) {
        J(S).dataModel = i, S.traverse(function(w) {
          J(w).dataModel = i;
        });
      });
      function _(S, w, b) {
        var x = S.getItemModel(w);
        Mu(S, w, b, e, a);
        var M = x.getModel("itemStyle").getItemStyle();
        M.fill == null && (M.fill = Vh(l, "color")), S.setItemVisual(w, {
          symbolKeepAspect: x.get("symbolKeepAspect"),
          // `0` should be considered as a valid value, so use `retrieve2` instead of `||`
          symbolOffset: Z(x.get("symbolOffset", !0), m[b ? 0 : 1]),
          symbolRotate: Z(x.get("symbolRotate", !0), y[b ? 0 : 1]),
          // TODO: when 2d array is supported, it should ignore parent
          symbolSize: Z(x.get("symbolSize"), d[b ? 0 : 1]),
          symbol: Z(x.get("symbol", !0), g[b ? 0 : 1]),
          style: M
        });
      }
      this.markKeep(f), f.group.silent = i.get("silent") || e.get("silent");
    }, t.type = "markLine", t;
  })(ML)
);
function PL(r, t, e) {
  var i;
  r ? i = z(r && r.dimensions, function(u) {
    var f = t.getData().getDimensionInfo(t.getData().mapDimension(u)) || {};
    return k(k({}, f), {
      name: u,
      // DON'T use ordinalMeta to parse and collect ordinal.
      ordinalMeta: null
    });
  }) : i = [{
    name: "value",
    type: "float"
  }];
  var n = new Kn(i, e), a = new Kn(i, e), o = new Kn([], e), s = z(e.get("data"), ht(AL, t, r, e));
  r && (s = xt(s, ht(IL, r)));
  var l = CL(!!r, i);
  return n.initData(z(s, function(u) {
    return u[0];
  }), null, l), a.initData(z(s, function(u) {
    return u[1];
  }), null, l), o.initData(z(s, function(u) {
    return u[2];
  })), o.hasItemOption = !0, {
    from: n,
    to: a,
    line: o
  };
}
function RL(r) {
  r.registerComponentModel(DL), r.registerComponentView(LL), r.registerPreprocessor(function(t) {
    bL(t.series, "markLine") && (t.markLine = t.markLine || {});
  });
}
var EL = function(r, t) {
  if (t === "all")
    return {
      type: "all",
      title: r.getLocaleModel().get(["legend", "selector", "all"])
    };
  if (t === "inverse")
    return {
      type: "inverse",
      title: r.getLocaleModel().get(["legend", "selector", "inverse"])
    };
}, Hf = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e.layoutMode = {
        type: "box",
        // legend.width/height are maxWidth/maxHeight actually,
        // whereas real width/height is calculated by its content.
        // (Setting {left: 10, right: 10} does not make sense).
        // So consider the case:
        // `setOption({legend: {left: 10});`
        // then `setOption({legend: {right: 10});`
        // The previous `left` should be cleared by setting `ignoreSize`.
        ignoreSize: !0
      }, e;
    }
    return t.prototype.init = function(e, i, n) {
      this.mergeDefaultAndTheme(e, n), e.selected = e.selected || {}, this._updateSelector(e);
    }, t.prototype.mergeOption = function(e, i) {
      r.prototype.mergeOption.call(this, e, i), this._updateSelector(e);
    }, t.prototype._updateSelector = function(e) {
      var i = e.selector, n = this.ecModel;
      i === !0 && (i = e.selector = ["all", "inverse"]), O(i) && T(i, function(a, o) {
        V(a) && (a = {
          type: a
        }), i[o] = j(a, EL(n, a.type));
      });
    }, t.prototype.optionUpdated = function() {
      this._updateData(this.ecModel);
      var e = this._data;
      if (e[0] && this.get("selectedMode") === "single") {
        for (var i = !1, n = 0; n < e.length; n++) {
          var a = e[n].get("name");
          if (this.isSelected(a)) {
            this.select(a), i = !0;
            break;
          }
        }
        !i && this.select(e[0].get("name"));
      }
    }, t.prototype._updateData = function(e) {
      var i = [], n = [];
      e.eachRawSeries(function(l) {
        var u = l.name;
        n.push(u);
        var f;
        if (l.legendVisualProvider) {
          var h = l.legendVisualProvider, c = h.getAllNames();
          e.isSeriesFiltered(l) || (n = n.concat(c)), c.length ? i = i.concat(c) : f = !0;
        } else
          f = !0;
        f && hh(l) && i.push(l.name);
      }), this._availableNames = n;
      var a = this.get("data") || i, o = q(), s = z(a, function(l) {
        return (V(l) || vt(l)) && (l = {
          name: l
        }), o.get(l.name) ? null : (o.set(l.name, !0), new pt(l, this, this.ecModel));
      }, this);
      this._data = xt(s, function(l) {
        return !!l;
      });
    }, t.prototype.getData = function() {
      return this._data;
    }, t.prototype.select = function(e) {
      var i = this.option.selected, n = this.get("selectedMode");
      if (n === "single") {
        var a = this._data;
        T(a, function(o) {
          i[o.get("name")] = !1;
        });
      }
      i[e] = !0;
    }, t.prototype.unSelect = function(e) {
      this.get("selectedMode") !== "single" && (this.option.selected[e] = !1);
    }, t.prototype.toggleSelected = function(e) {
      var i = this.option.selected;
      i.hasOwnProperty(e) || (i[e] = !0), this[i[e] ? "unSelect" : "select"](e);
    }, t.prototype.allSelect = function() {
      var e = this._data, i = this.option.selected;
      T(e, function(n) {
        i[n.get("name", !0)] = !0;
      });
    }, t.prototype.inverseSelect = function() {
      var e = this._data, i = this.option.selected;
      T(e, function(n) {
        var a = n.get("name", !0);
        i.hasOwnProperty(a) || (i[a] = !0), i[a] = !i[a];
      });
    }, t.prototype.isSelected = function(e) {
      var i = this.option.selected;
      return !(i.hasOwnProperty(e) && !i[e]) && nt(this._availableNames, e) >= 0;
    }, t.prototype.getOrient = function() {
      return this.get("orient") === "vertical" ? {
        index: 1,
        name: "vertical"
      } : {
        index: 0,
        name: "horizontal"
      };
    }, t.type = "legend.plain", t.dependencies = ["series"], t.defaultOption = {
      // zlevel: 0,
      z: 4,
      show: !0,
      orient: "horizontal",
      left: "center",
      // right: 'center',
      top: 0,
      // bottom: null,
      align: "auto",
      backgroundColor: "rgba(0,0,0,0)",
      borderColor: "#ccc",
      borderRadius: 0,
      borderWidth: 0,
      padding: 5,
      itemGap: 10,
      itemWidth: 25,
      itemHeight: 14,
      symbolRotate: "inherit",
      symbolKeepAspect: !0,
      inactiveColor: "#ccc",
      inactiveBorderColor: "#ccc",
      inactiveBorderWidth: "auto",
      itemStyle: {
        color: "inherit",
        opacity: "inherit",
        borderColor: "inherit",
        borderWidth: "auto",
        borderCap: "inherit",
        borderJoin: "inherit",
        borderDashOffset: "inherit",
        borderMiterLimit: "inherit"
      },
      lineStyle: {
        width: "auto",
        color: "inherit",
        inactiveColor: "#ccc",
        inactiveWidth: 2,
        opacity: "inherit",
        type: "inherit",
        cap: "inherit",
        join: "inherit",
        dashOffset: "inherit",
        miterLimit: "inherit"
      },
      textStyle: {
        color: "#333"
      },
      selectedMode: !0,
      selector: !1,
      selectorLabel: {
        show: !0,
        borderRadius: 10,
        padding: [3, 5, 3, 5],
        fontSize: 12,
        fontFamily: "sans-serif",
        color: "#666",
        borderWidth: 1,
        borderColor: "#666"
      },
      emphasis: {
        selectorLabel: {
          show: !0,
          color: "#eee",
          backgroundColor: "#666"
        }
      },
      selectorPosition: "auto",
      selectorItemGap: 7,
      selectorButtonGap: 10,
      tooltip: {
        show: !1
      }
    }, t;
  })(rt)
), Ni = ht, Gf = T, Co = gt, S_ = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e.newlineDisabled = !1, e;
    }
    return t.prototype.init = function() {
      this.group.add(this._contentGroup = new Co()), this.group.add(this._selectorGroup = new Co()), this._isFirstRender = !0;
    }, t.prototype.getContentGroup = function() {
      return this._contentGroup;
    }, t.prototype.getSelectorGroup = function() {
      return this._selectorGroup;
    }, t.prototype.render = function(e, i, n) {
      var a = this._isFirstRender;
      if (this._isFirstRender = !1, this.resetInner(), !!e.get("show", !0)) {
        var o = e.get("align"), s = e.get("orient");
        (!o || o === "auto") && (o = e.get("left") === "right" && s === "vertical" ? "right" : "left");
        var l = e.get("selector", !0), u = e.get("selectorPosition", !0);
        l && (!u || u === "auto") && (u = s === "horizontal" ? "end" : "start"), this.renderInner(o, e, i, n, l, s, u);
        var f = e.getBoxLayoutParams(), h = {
          width: n.getWidth(),
          height: n.getHeight()
        }, c = e.get("padding"), v = Ar(f, h, c), p = this.layoutInner(e, o, v, a, l, u), g = Ar(at({
          width: p.width,
          height: p.height
        }, f), h, c);
        this.group.x = g.x - p.x, this.group.y = g.y - p.y, this.group.markRedraw(), this.group.add(this._backgroundEl = KI(p, e));
      }
    }, t.prototype.resetInner = function() {
      this.getContentGroup().removeAll(), this._backgroundEl && this.group.remove(this._backgroundEl), this.getSelectorGroup().removeAll();
    }, t.prototype.renderInner = function(e, i, n, a, o, s, l) {
      var u = this.getContentGroup(), f = q(), h = i.get("selectedMode"), c = [];
      n.eachRawSeries(function(v) {
        !v.get("legendHoverLink") && c.push(v.id);
      }), Gf(i.getData(), function(v, p) {
        var g = v.get("name");
        if (!this.newlineDisabled && (g === "" || g === `
`)) {
          var d = new Co();
          d.newline = !0, u.add(d);
          return;
        }
        var y = n.getSeriesByName(g)[0];
        if (!f.get(g))
          if (y) {
            var m = y.getData(), _ = m.getVisual("legendLineStyle") || {}, S = m.getVisual("legendIcon"), w = m.getVisual("style"), b = this._createItem(y, g, p, v, i, e, _, w, S, h, a);
            b.on("click", Ni(eg, g, null, a, c)).on("mouseover", Ni(Wf, y.name, null, a, c)).on("mouseout", Ni(Uf, y.name, null, a, c)), n.ssr && b.eachChild(function(x) {
              var M = J(x);
              M.seriesIndex = y.seriesIndex, M.dataIndex = p, M.ssrType = "legend";
            }), f.set(g, !0);
          } else
            n.eachRawSeries(function(x) {
              if (!f.get(g) && x.legendVisualProvider) {
                var M = x.legendVisualProvider;
                if (!M.containName(g))
                  return;
                var D = M.indexOfName(g), A = M.getItemVisual(D, "style"), C = M.getItemVisual(D, "legendIcon"), I = Kt(A.fill);
                I && I[3] === 0 && (I[3] = 0.2, A = k(k({}, A), {
                  fill: Le(I, "rgba")
                }));
                var L = this._createItem(x, g, p, v, i, e, {}, A, C, h, a);
                L.on("click", Ni(eg, null, g, a, c)).on("mouseover", Ni(Wf, null, g, a, c)).on("mouseout", Ni(Uf, null, g, a, c)), n.ssr && L.eachChild(function(P) {
                  var R = J(P);
                  R.seriesIndex = x.seriesIndex, R.dataIndex = p, R.ssrType = "legend";
                }), f.set(g, !0);
              }
            }, this);
      }, this), o && this._createSelector(o, i, a, s, l);
    }, t.prototype._createSelector = function(e, i, n, a, o) {
      var s = this.getSelectorGroup();
      Gf(e, function(u) {
        var f = u.type, h = new mt({
          style: {
            x: 0,
            y: 0,
            align: "center",
            verticalAlign: "middle"
          },
          onclick: function() {
            n.dispatchAction({
              type: f === "all" ? "legendAllSelect" : "legendInverseSelect",
              legendId: i.id
            });
          }
        });
        s.add(h);
        var c = i.getModel("selectorLabel"), v = i.getModel(["emphasis", "selectorLabel"]);
        nn(h, {
          normal: c,
          emphasis: v
        }, {
          defaultText: u.title
        }), ts(h);
      });
    }, t.prototype._createItem = function(e, i, n, a, o, s, l, u, f, h, c) {
      var v = e.visualDrawType, p = o.get("itemWidth"), g = o.get("itemHeight"), d = o.isSelected(i), y = a.get("symbolRotate"), m = a.get("symbolKeepAspect"), _ = a.get("icon");
      f = _ || f || "roundRect";
      var S = OL(f, a, l, u, v, d, c), w = new Co(), b = a.getModel("textStyle");
      if (X(e.getLegendIcon) && (!_ || _ === "inherit"))
        w.add(e.getLegendIcon({
          itemWidth: p,
          itemHeight: g,
          icon: f,
          iconRotate: y,
          itemStyle: S.itemStyle,
          lineStyle: S.lineStyle,
          symbolKeepAspect: m
        }));
      else {
        var x = _ === "inherit" && e.getData().getVisual("symbol") ? y === "inherit" ? e.getData().getVisual("symbolRotate") : y : 0;
        w.add(kL({
          itemWidth: p,
          itemHeight: g,
          icon: f,
          iconRotate: x,
          itemStyle: S.itemStyle,
          symbolKeepAspect: m
        }));
      }
      var M = s === "left" ? p + 5 : -5, D = s, A = o.get("formatter"), C = i;
      V(A) && A ? C = A.replace("{name}", i ?? "") : X(A) && (C = A(i));
      var I = d ? b.getTextColor() : a.get("inactiveColor");
      w.add(new mt({
        style: re(b, {
          text: C,
          x: M,
          y: g / 2,
          fill: I,
          align: D,
          verticalAlign: "middle"
        }, {
          inheritColor: I
        })
      }));
      var L = new dt({
        shape: w.getBoundingRect(),
        style: {
          // Cannot use 'invisible' because SVG SSR will miss the node
          fill: "transparent"
        }
      }), P = a.getModel("tooltip");
      return P.get("show") && Bs({
        el: L,
        componentModel: o,
        itemName: i,
        itemTooltipOption: P.option
      }), w.add(L), w.eachChild(function(R) {
        R.silent = !0;
      }), L.silent = !h, this.getContentGroup().add(w), ts(w), w.__legendDataIndex = n, w;
    }, t.prototype.layoutInner = function(e, i, n, a, o, s) {
      var l = this.getContentGroup(), u = this.getSelectorGroup();
      qi(e.get("orient"), l, e.get("itemGap"), n.width, n.height);
      var f = l.getBoundingRect(), h = [-f.x, -f.y];
      if (u.markRedraw(), l.markRedraw(), o) {
        qi(
          // Buttons in selectorGroup always layout horizontally
          "horizontal",
          u,
          e.get("selectorItemGap", !0)
        );
        var c = u.getBoundingRect(), v = [-c.x, -c.y], p = e.get("selectorButtonGap", !0), g = e.getOrient().index, d = g === 0 ? "width" : "height", y = g === 0 ? "height" : "width", m = g === 0 ? "y" : "x";
        s === "end" ? v[g] += f[d] + p : h[g] += c[d] + p, v[1 - g] += f[y] / 2 - c[y] / 2, u.x = v[0], u.y = v[1], l.x = h[0], l.y = h[1];
        var _ = {
          x: 0,
          y: 0
        };
        return _[d] = f[d] + p + c[d], _[y] = Math.max(f[y], c[y]), _[m] = Math.min(0, c[m] + v[1 - g]), _;
      } else
        return l.x = h[0], l.y = h[1], this.group.getBoundingRect();
    }, t.prototype.remove = function() {
      this.getContentGroup().removeAll(), this._isFirstRender = !0;
    }, t.type = "legend.plain", t;
  })(kt)
);
function OL(r, t, e, i, n, a, o) {
  function s(d, y) {
    d.lineWidth === "auto" && (d.lineWidth = y.lineWidth > 0 ? 2 : 0), Gf(d, function(m, _) {
      d[_] === "inherit" && (d[_] = y[_]);
    });
  }
  var l = t.getModel("itemStyle"), u = l.getItemStyle(), f = r.lastIndexOf("empty", 0) === 0 ? "fill" : "stroke", h = l.getShallow("decal");
  u.decal = !h || h === "inherit" ? i.decal : xf(h, o), u.fill === "inherit" && (u.fill = i[n]), u.stroke === "inherit" && (u.stroke = i[f]), u.opacity === "inherit" && (u.opacity = (n === "fill" ? i : e).opacity), s(u, i);
  var c = t.getModel("lineStyle"), v = c.getLineStyle();
  if (s(v, e), u.fill === "auto" && (u.fill = i.fill), u.stroke === "auto" && (u.stroke = i.fill), v.stroke === "auto" && (v.stroke = i.fill), !a) {
    var p = t.get("inactiveBorderWidth"), g = u[f];
    u.lineWidth = p === "auto" ? i.lineWidth > 0 && g ? 2 : 0 : u.lineWidth, u.fill = t.get("inactiveColor"), u.stroke = t.get("inactiveBorderColor"), v.stroke = c.get("inactiveColor"), v.lineWidth = c.get("inactiveWidth");
  }
  return {
    itemStyle: u,
    lineStyle: v
  };
}
function kL(r) {
  var t = r.icon || "roundRect", e = ge(t, 0, 0, r.itemWidth, r.itemHeight, r.itemStyle.fill, r.symbolKeepAspect);
  return e.setStyle(r.itemStyle), e.rotation = (r.iconRotate || 0) * Math.PI / 180, e.setOrigin([r.itemWidth / 2, r.itemHeight / 2]), t.indexOf("empty") > -1 && (e.style.stroke = e.style.fill, e.style.fill = "#fff", e.style.lineWidth = 2), e;
}
function eg(r, t, e, i) {
  Uf(r, t, e, i), e.dispatchAction({
    type: "legendToggleSelect",
    name: r ?? t
  }), Wf(r, t, e, i);
}
function b_(r) {
  for (var t = r.getZr().storage.getDisplayList(), e, i = 0, n = t.length; i < n && !(e = t[i].states.emphasis); )
    i++;
  return e && e.hoverLayer;
}
function Wf(r, t, e, i) {
  b_(e) || e.dispatchAction({
    type: "highlight",
    seriesName: r,
    name: t,
    excludeSeriesId: i
  });
}
function Uf(r, t, e, i) {
  b_(e) || e.dispatchAction({
    type: "downplay",
    seriesName: r,
    name: t,
    excludeSeriesId: i
  });
}
function NL(r) {
  var t = r.findComponents({
    mainType: "legend"
  });
  t && t.length && r.filterSeries(function(e) {
    for (var i = 0; i < t.length; i++)
      if (!t[i].isSelected(e.name))
        return !1;
    return !0;
  });
}
function Ln(r, t, e) {
  var i = r === "allSelect" || r === "inverseSelect", n = {}, a = [];
  e.eachComponent({
    mainType: "legend",
    query: t
  }, function(s) {
    i ? s[r]() : s[r](t.name), rg(s, n), a.push(s.componentIndex);
  });
  var o = {};
  return e.eachComponent("legend", function(s) {
    T(n, function(l, u) {
      s[l ? "select" : "unSelect"](u);
    }), rg(s, o);
  }), i ? {
    selected: o,
    // return legendIndex array to tell the developers which legends are allSelect / inverseSelect
    legendIndex: a
  } : {
    name: t.name,
    selected: o
  };
}
function rg(r, t) {
  var e = t || {};
  return T(r.getData(), function(i) {
    var n = i.get("name");
    if (!(n === `
` || n === "")) {
      var a = r.isSelected(n);
      Mr(e, n) ? e[n] = e[n] && a : e[n] = a;
    }
  }), e;
}
function BL(r) {
  r.registerAction("legendToggleSelect", "legendselectchanged", ht(Ln, "toggleSelected")), r.registerAction("legendAllSelect", "legendselectall", ht(Ln, "allSelect")), r.registerAction("legendInverseSelect", "legendinverseselect", ht(Ln, "inverseSelect")), r.registerAction("legendSelect", "legendselected", ht(Ln, "select")), r.registerAction("legendUnSelect", "legendunselected", ht(Ln, "unSelect"));
}
function w_(r) {
  r.registerComponentModel(Hf), r.registerComponentView(S_), r.registerProcessor(r.PRIORITY.PROCESSOR.SERIES_FILTER, NL), r.registerSubTypeDefaulter("legend", function() {
    return "plain";
  }), BL(r);
}
var zL = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e;
    }
    return t.prototype.setScrollDataIndex = function(e) {
      this.option.scrollDataIndex = e;
    }, t.prototype.init = function(e, i, n) {
      var a = Xs(e);
      r.prototype.init.call(this, e, i, n), ig(this, e, a);
    }, t.prototype.mergeOption = function(e, i) {
      r.prototype.mergeOption.call(this, e, i), ig(this, this.option, e);
    }, t.type = "legend.scroll", t.defaultOption = Hs(Hf.defaultOption, {
      scrollDataIndex: 0,
      pageButtonItemGap: 5,
      pageButtonGap: null,
      pageButtonPosition: "end",
      pageFormatter: "{current}/{total}",
      pageIcons: {
        horizontal: ["M0,0L12,-10L12,10z", "M0,0L-12,-10L-12,10z"],
        vertical: ["M0,0L20,0L10,-20z", "M0,0L20,0L10,20z"]
      },
      pageIconColor: "#2f4554",
      pageIconInactiveColor: "#aaa",
      pageIconSize: 15,
      pageTextStyle: {
        color: "#333"
      },
      animationDurationUpdate: 800
    }), t;
  })(Hf)
);
function ig(r, t, e) {
  var i = r.getOrient(), n = [1, 1];
  n[i.index] = 0, ji(t, e, {
    type: "box",
    ignoreSize: !!n
  });
}
var ng = gt, Du = ["width", "height"], Au = ["x", "y"], FL = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e.newlineDisabled = !0, e._currentIndex = 0, e;
    }
    return t.prototype.init = function() {
      r.prototype.init.call(this), this.group.add(this._containerGroup = new ng()), this._containerGroup.add(this.getContentGroup()), this.group.add(this._controllerGroup = new ng());
    }, t.prototype.resetInner = function() {
      r.prototype.resetInner.call(this), this._controllerGroup.removeAll(), this._containerGroup.removeClipPath(), this._containerGroup.__rectSize = null;
    }, t.prototype.renderInner = function(e, i, n, a, o, s, l) {
      var u = this;
      r.prototype.renderInner.call(this, e, i, n, a, o, s, l);
      var f = this._controllerGroup, h = i.get("pageIconSize", !0), c = O(h) ? h : [h, h];
      p("pagePrev", 0);
      var v = i.getModel("pageTextStyle");
      f.add(new mt({
        name: "pageText",
        style: {
          // Placeholder to calculate a proper layout.
          text: "xx/xx",
          fill: v.getTextColor(),
          font: v.getFont(),
          verticalAlign: "middle",
          align: "center"
        },
        silent: !0
      })), p("pageNext", 1);
      function p(g, d) {
        var y = g + "DataIndex", m = Ns(i.get("pageIcons", !0)[i.getOrient().name][d], {
          // Buttons will be created in each render, so we do not need
          // to worry about avoiding using legendModel kept in scope.
          onclick: Q(u._pageGo, u, y, i, a)
        }, {
          x: -c[0] / 2,
          y: -c[1] / 2,
          width: c[0],
          height: c[1]
        });
        m.name = g, f.add(m);
      }
    }, t.prototype.layoutInner = function(e, i, n, a, o, s) {
      var l = this.getSelectorGroup(), u = e.getOrient().index, f = Du[u], h = Au[u], c = Du[1 - u], v = Au[1 - u];
      o && qi(
        // Buttons in selectorGroup always layout horizontally
        "horizontal",
        l,
        e.get("selectorItemGap", !0)
      );
      var p = e.get("selectorButtonGap", !0), g = l.getBoundingRect(), d = [-g.x, -g.y], y = U(n);
      o && (y[f] = n[f] - g[f] - p);
      var m = this._layoutContentAndController(e, a, y, u, f, c, v, h);
      if (o) {
        if (s === "end")
          d[u] += m[f] + p;
        else {
          var _ = g[f] + p;
          d[u] -= _, m[h] -= _;
        }
        m[f] += g[f] + p, d[1 - u] += m[v] + m[c] / 2 - g[c] / 2, m[c] = Math.max(m[c], g[c]), m[v] = Math.min(m[v], g[v] + d[1 - u]), l.x = d[0], l.y = d[1], l.markRedraw();
      }
      return m;
    }, t.prototype._layoutContentAndController = function(e, i, n, a, o, s, l, u) {
      var f = this.getContentGroup(), h = this._containerGroup, c = this._controllerGroup;
      qi(e.get("orient"), f, e.get("itemGap"), a ? n.width : null, a ? null : n.height), qi(
        // Buttons in controller are layout always horizontally.
        "horizontal",
        c,
        e.get("pageButtonItemGap", !0)
      );
      var v = f.getBoundingRect(), p = c.getBoundingRect(), g = this._showController = v[o] > n[o], d = [-v.x, -v.y];
      i || (d[a] = f[u]);
      var y = [0, 0], m = [-p.x, -p.y], _ = Z(e.get("pageButtonGap", !0), e.get("itemGap", !0));
      if (g) {
        var S = e.get("pageButtonPosition", !0);
        S === "end" ? m[a] += n[o] - p[o] : y[a] += p[o] + _;
      }
      m[1 - a] += v[s] / 2 - p[s] / 2, f.setPosition(d), h.setPosition(y), c.setPosition(m);
      var w = {
        x: 0,
        y: 0
      };
      if (w[o] = g ? n[o] : v[o], w[s] = Math.max(v[s], p[s]), w[l] = Math.min(0, p[l] + m[1 - a]), h.__rectSize = n[o], g) {
        var b = {
          x: 0,
          y: 0
        };
        b[o] = Math.max(n[o] - p[o] - _, 0), b[s] = w[s], h.setClipPath(new dt({
          shape: b
        })), h.__rectSize = b[o];
      } else
        c.eachChild(function(M) {
          M.attr({
            invisible: !0,
            silent: !0
          });
        });
      var x = this._getPageInfo(e);
      return x.pageIndex != null && Wt(
        f,
        {
          x: x.contentPosition[0],
          y: x.contentPosition[1]
        },
        // When switch from "show controller" to "not show controller", view should be
        // updated immediately without animation, otherwise causes weird effect.
        g ? e : null
      ), this._updatePageInfoView(e, x), w;
    }, t.prototype._pageGo = function(e, i, n) {
      var a = this._getPageInfo(i)[e];
      a != null && n.dispatchAction({
        type: "legendScroll",
        scrollDataIndex: a,
        legendId: i.id
      });
    }, t.prototype._updatePageInfoView = function(e, i) {
      var n = this._controllerGroup;
      T(["pagePrev", "pageNext"], function(f) {
        var h = f + "DataIndex", c = i[h] != null, v = n.childOfName(f);
        v && (v.setStyle("fill", c ? e.get("pageIconColor", !0) : e.get("pageIconInactiveColor", !0)), v.cursor = c ? "pointer" : "default");
      });
      var a = n.childOfName("pageText"), o = e.get("pageFormatter"), s = i.pageIndex, l = s != null ? s + 1 : 0, u = i.pageCount;
      a && o && a.setStyle("text", V(o) ? o.replace("{current}", l == null ? "" : l + "").replace("{total}", u == null ? "" : u + "") : o({
        current: l,
        total: u
      }));
    }, t.prototype._getPageInfo = function(e) {
      var i = e.get("scrollDataIndex", !0), n = this.getContentGroup(), a = this._containerGroup.__rectSize, o = e.getOrient().index, s = Du[o], l = Au[o], u = this._findTargetItemIndex(i), f = n.children(), h = f[u], c = f.length, v = c ? 1 : 0, p = {
        contentPosition: [n.x, n.y],
        pageCount: v,
        pageIndex: v - 1,
        pagePrevDataIndex: null,
        pageNextDataIndex: null
      };
      if (!h)
        return p;
      var g = S(h);
      p.contentPosition[o] = -g.s;
      for (var d = u + 1, y = g, m = g, _ = null; d <= c; ++d)
        _ = S(f[d]), // Half of the last item is out of the window.
        (!_ && m.e > y.s + a || _ && !w(_, y.s)) && (m.i > y.i ? y = m : y = _, y && (p.pageNextDataIndex == null && (p.pageNextDataIndex = y.i), ++p.pageCount)), m = _;
      for (var d = u - 1, y = g, m = g, _ = null; d >= -1; --d)
        _ = S(f[d]), // If the the end item does not intersect with the window started
        // from the current item, a page can be settled.
        (!_ || !w(m, _.s)) && y.i < m.i && (m = y, p.pagePrevDataIndex == null && (p.pagePrevDataIndex = y.i), ++p.pageCount, ++p.pageIndex), y = _;
      return p;
      function S(b) {
        if (b) {
          var x = b.getBoundingRect(), M = x[l] + b[l];
          return {
            s: M,
            e: M + x[s],
            i: b.__legendDataIndex
          };
        }
      }
      function w(b, x) {
        return b.e >= x && b.s <= x + a;
      }
    }, t.prototype._findTargetItemIndex = function(e) {
      if (!this._showController)
        return 0;
      var i, n = this.getContentGroup(), a;
      return n.eachChild(function(o, s) {
        var l = o.__legendDataIndex;
        a == null && l != null && (a = s), l === e && (i = s);
      }), i ?? a;
    }, t.type = "legend.scroll", t;
  })(S_)
);
function VL(r) {
  r.registerAction("legendScroll", "legendscroll", function(t, e) {
    var i = t.scrollDataIndex;
    i != null && e.eachComponent({
      mainType: "legend",
      subType: "scroll",
      query: t
    }, function(n) {
      n.setScrollDataIndex(i);
    });
  });
}
function HL(r) {
  ye(w_), r.registerComponentModel(zL), r.registerComponentView(FL), VL(r);
}
function GL(r) {
  ye(w_), ye(HL);
}
var x_ = {
  /**
   * @public
   */
  get: function(r, t, e) {
    var i = U((WL[r] || {})[t]);
    return e && O(i) ? i[i.length - 1] : i;
  }
}, WL = {
  color: {
    active: ["#006edd", "#e0ffff"],
    inactive: ["rgba(0,0,0,0)"]
  },
  colorHue: {
    active: [0, 360],
    inactive: [0, 0]
  },
  colorSaturation: {
    active: [0.3, 1],
    inactive: [0, 0]
  },
  colorLightness: {
    active: [0.9, 0.5],
    inactive: [0, 0]
  },
  colorAlpha: {
    active: [0.3, 1],
    inactive: [0, 0]
  },
  opacity: {
    active: [0.3, 1],
    inactive: [0, 0]
  },
  symbol: {
    active: ["circle", "roundRect", "diamond"],
    inactive: ["none"]
  },
  symbolSize: {
    active: [10, 50],
    inactive: [0, 0]
  }
}, ag = Ot.mapVisual, UL = Ot.eachVisual, YL = O, og = T, XL = lh, $L = Ye, gs = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e.stateList = ["inRange", "outOfRange"], e.replacableOptionKeys = ["inRange", "outOfRange", "target", "controller", "color"], e.layoutMode = {
        type: "box",
        ignoreSize: !0
      }, e.dataBound = [-1 / 0, 1 / 0], e.targetVisuals = {}, e.controllerVisuals = {}, e;
    }
    return t.prototype.init = function(e, i, n) {
      this.mergeDefaultAndTheme(e, n);
    }, t.prototype.optionUpdated = function(e, i) {
      var n = this.option;
      !i && gL(n, e, this.replacableOptionKeys), this.textStyleModel = this.getModel("textStyle"), this.resetItemSize(), this.completeVisualOption();
    }, t.prototype.resetVisual = function(e) {
      var i = this.stateList;
      e = Q(e, this), this.controllerVisuals = Qd(this.option.controller, i, e), this.targetVisuals = Qd(this.option.target, i, e);
    }, t.prototype.getItemSymbol = function() {
      return null;
    }, t.prototype.getTargetSeriesIndices = function() {
      var e = this.option.seriesIndex, i = [];
      return e == null || e === "all" ? this.ecModel.eachSeries(function(n, a) {
        i.push(a);
      }) : i = Dt(e), i;
    }, t.prototype.eachTargetSeries = function(e, i) {
      T(this.getTargetSeriesIndices(), function(n) {
        var a = this.ecModel.getSeriesByIndex(n);
        a && e.call(i, a);
      }, this);
    }, t.prototype.isTargetSeries = function(e) {
      var i = !1;
      return this.eachTargetSeries(function(n) {
        n === e && (i = !0);
      }), i;
    }, t.prototype.formatValueText = function(e, i, n) {
      var a = this.option, o = a.precision, s = this.dataBound, l = a.formatter, u;
      n = n || ["<", ">"], O(e) && (e = e.slice(), u = !0);
      var f = i ? e : u ? [h(e[0]), h(e[1])] : h(e);
      if (V(l))
        return l.replace("{value}", u ? f[0] : f).replace("{value2}", u ? f[1] : f);
      if (X(l))
        return u ? l(e[0], e[1]) : l(e);
      if (u)
        return e[0] === s[0] ? n[0] + " " + f[1] : e[1] === s[1] ? n[1] + " " + f[0] : f[0] + " - " + f[1];
      return f;
      function h(c) {
        return c === s[0] ? "min" : c === s[1] ? "max" : (+c).toFixed(Math.min(o, 20));
      }
    }, t.prototype.resetExtent = function() {
      var e = this.option, i = XL([e.min, e.max]);
      this._dataExtent = i;
    }, t.prototype.getDataDimensionIndex = function(e) {
      var i = this.option.dimension;
      if (i != null)
        return e.getDimensionIndex(i);
      for (var n = e.dimensions, a = n.length - 1; a >= 0; a--) {
        var o = n[a], s = e.getDimensionInfo(o);
        if (!s.isCalculationCoord)
          return s.storeDimIndex;
      }
    }, t.prototype.getExtent = function() {
      return this._dataExtent.slice();
    }, t.prototype.completeVisualOption = function() {
      var e = this.ecModel, i = this.option, n = {
        inRange: i.inRange,
        outOfRange: i.outOfRange
      }, a = i.target || (i.target = {}), o = i.controller || (i.controller = {});
      j(a, n), j(o, n);
      var s = this.isCategory();
      l.call(this, a), l.call(this, o), u.call(this, a, "inRange", "outOfRange"), f.call(this, o);
      function l(h) {
        YL(i.color) && !h.inRange && (h.inRange = {
          color: i.color.slice().reverse()
        }), h.inRange = h.inRange || {
          color: e.get("gradientColor")
        };
      }
      function u(h, c, v) {
        var p = h[c], g = h[v];
        p && !g && (g = h[v] = {}, og(p, function(d, y) {
          if (Ot.isValidType(y)) {
            var m = x_.get(y, "inactive", s);
            m != null && (g[y] = m, y === "color" && !g.hasOwnProperty("opacity") && !g.hasOwnProperty("colorAlpha") && (g.opacity = [0, 0]));
          }
        }));
      }
      function f(h) {
        var c = (h.inRange || {}).symbol || (h.outOfRange || {}).symbol, v = (h.inRange || {}).symbolSize || (h.outOfRange || {}).symbolSize, p = this.get("inactiveColor"), g = this.getItemSymbol(), d = g || "roundRect";
        og(this.stateList, function(y) {
          var m = this.itemSize, _ = h[y];
          _ || (_ = h[y] = {
            color: s ? p : [p]
          }), _.symbol == null && (_.symbol = c && U(c) || (s ? d : [d])), _.symbolSize == null && (_.symbolSize = v && U(v) || (s ? m[0] : [m[0], m[0]])), _.symbol = ag(_.symbol, function(b) {
            return b === "none" ? d : b;
          });
          var S = _.symbolSize;
          if (S != null) {
            var w = -1 / 0;
            UL(S, function(b) {
              b > w && (w = b);
            }), _.symbolSize = ag(S, function(b) {
              return $L(b, [0, w], [0, m[0]], !0);
            });
          }
        }, this);
      }
    }, t.prototype.resetItemSize = function() {
      this.itemSize = [parseFloat(this.get("itemWidth")), parseFloat(this.get("itemHeight"))];
    }, t.prototype.isCategory = function() {
      return !!this.option.categories;
    }, t.prototype.setSelected = function(e) {
    }, t.prototype.getSelected = function() {
      return null;
    }, t.prototype.getValueState = function(e) {
      return null;
    }, t.prototype.getVisualMeta = function(e) {
      return null;
    }, t.type = "visualMap", t.dependencies = ["series"], t.defaultOption = {
      show: !0,
      // zlevel: 0,
      z: 4,
      seriesIndex: "all",
      min: 0,
      max: 200,
      left: 0,
      right: null,
      top: null,
      bottom: 0,
      itemWidth: null,
      itemHeight: null,
      inverse: !1,
      orient: "vertical",
      backgroundColor: "rgba(0,0,0,0)",
      borderColor: "#ccc",
      contentColor: "#5793f3",
      inactiveColor: "#aaa",
      borderWidth: 0,
      padding: 5,
      // 接受数组分别设定上右下左边距，同css
      textGap: 10,
      precision: 0,
      textStyle: {
        color: "#333"
        // 值域文字颜色
      }
    }, t;
  })(rt)
), sg = [20, 140], ZL = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e;
    }
    return t.prototype.optionUpdated = function(e, i) {
      r.prototype.optionUpdated.apply(this, arguments), this.resetExtent(), this.resetVisual(function(n) {
        n.mappingMethod = "linear", n.dataExtent = this.getExtent();
      }), this._resetRange();
    }, t.prototype.resetItemSize = function() {
      r.prototype.resetItemSize.apply(this, arguments);
      var e = this.itemSize;
      (e[0] == null || isNaN(e[0])) && (e[0] = sg[0]), (e[1] == null || isNaN(e[1])) && (e[1] = sg[1]);
    }, t.prototype._resetRange = function() {
      var e = this.getExtent(), i = this.option.range;
      !i || i.auto ? (e.auto = 1, this.option.range = e) : O(i) && (i[0] > i[1] && i.reverse(), i[0] = Math.max(i[0], e[0]), i[1] = Math.min(i[1], e[1]));
    }, t.prototype.completeVisualOption = function() {
      r.prototype.completeVisualOption.apply(this, arguments), T(this.stateList, function(e) {
        var i = this.option.controller[e].symbolSize;
        i && i[0] !== i[1] && (i[0] = i[1] / 3);
      }, this);
    }, t.prototype.setSelected = function(e) {
      this.option.range = e.slice(), this._resetRange();
    }, t.prototype.getSelected = function() {
      var e = this.getExtent(), i = lh((this.get("range") || []).slice());
      return i[0] > e[1] && (i[0] = e[1]), i[1] > e[1] && (i[1] = e[1]), i[0] < e[0] && (i[0] = e[0]), i[1] < e[0] && (i[1] = e[0]), i;
    }, t.prototype.getValueState = function(e) {
      var i = this.option.range, n = this.getExtent();
      return (i[0] <= n[0] || i[0] <= e) && (i[1] >= n[1] || e <= i[1]) ? "inRange" : "outOfRange";
    }, t.prototype.findTargetDataIndices = function(e) {
      var i = [];
      return this.eachTargetSeries(function(n) {
        var a = [], o = n.getData();
        o.each(this.getDataDimensionIndex(o), function(s, l) {
          e[0] <= s && s <= e[1] && a.push(l);
        }, this), i.push({
          seriesId: n.id,
          dataIndex: a
        });
      }, this), i;
    }, t.prototype.getVisualMeta = function(e) {
      var i = lg(this, "outOfRange", this.getExtent()), n = lg(this, "inRange", this.option.range.slice()), a = [];
      function o(v, p) {
        a.push({
          value: v,
          color: e(v, p)
        });
      }
      for (var s = 0, l = 0, u = n.length, f = i.length; l < f && (!n.length || i[l] <= n[0]); l++)
        i[l] < n[s] && o(i[l], "outOfRange");
      for (var h = 1; s < u; s++, h = 0)
        h && a.length && o(n[s], "outOfRange"), o(n[s], "inRange");
      for (var h = 1; l < f; l++)
        (!n.length || n[n.length - 1] < i[l]) && (h && (a.length && o(a[a.length - 1].value, "outOfRange"), h = 0), o(i[l], "outOfRange"));
      var c = a.length;
      return {
        stops: a,
        outerColors: [c ? a[0].color : "transparent", c ? a[c - 1].color : "transparent"]
      };
    }, t.type = "visualMap.continuous", t.defaultOption = Hs(gs.defaultOption, {
      align: "auto",
      calculable: !1,
      hoverLink: !0,
      realtime: !0,
      handleIcon: "path://M-11.39,9.77h0a3.5,3.5,0,0,1-3.5,3.5h-22a3.5,3.5,0,0,1-3.5-3.5h0a3.5,3.5,0,0,1,3.5-3.5h22A3.5,3.5,0,0,1-11.39,9.77Z",
      handleSize: "120%",
      handleStyle: {
        borderColor: "#fff",
        borderWidth: 1
      },
      indicatorIcon: "circle",
      indicatorSize: "50%",
      indicatorStyle: {
        borderColor: "#fff",
        borderWidth: 2,
        shadowBlur: 2,
        shadowOffsetX: 1,
        shadowOffsetY: 1,
        shadowColor: "rgba(0,0,0,0.2)"
      }
      // emphasis: {
      //     handleStyle: {
      //         shadowBlur: 3,
      //         shadowOffsetX: 1,
      //         shadowOffsetY: 1,
      //         shadowColor: 'rgba(0,0,0,0.2)'
      //     }
      // }
    }), t;
  })(gs)
);
function lg(r, t, e) {
  if (e[0] === e[1])
    return e.slice();
  for (var i = 200, n = (e[1] - e[0]) / i, a = e[0], o = [], s = 0; s <= i && a < e[1]; s++)
    o.push(a), a += n;
  return o.push(e[1]), o;
}
var T_ = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e.autoPositionValues = {
        left: 1,
        right: 1,
        top: 1,
        bottom: 1
      }, e;
    }
    return t.prototype.init = function(e, i) {
      this.ecModel = e, this.api = i;
    }, t.prototype.render = function(e, i, n, a) {
      if (this.visualMapModel = e, e.get("show") === !1) {
        this.group.removeAll();
        return;
      }
      this.doRender(e, i, n, a);
    }, t.prototype.renderBackground = function(e) {
      var i = this.visualMapModel, n = an(i.get("padding") || 0), a = e.getBoundingRect();
      e.add(new dt({
        z2: -1,
        silent: !0,
        shape: {
          x: a.x - n[3],
          y: a.y - n[0],
          width: a.width + n[3] + n[1],
          height: a.height + n[0] + n[2]
        },
        style: {
          fill: i.get("backgroundColor"),
          stroke: i.get("borderColor"),
          lineWidth: i.get("borderWidth")
        }
      }));
    }, t.prototype.getControllerVisual = function(e, i, n) {
      n = n || {};
      var a = n.forceState, o = this.visualMapModel, s = {};
      if (i === "color") {
        var l = o.get("contentColor");
        s.color = l;
      }
      function u(v) {
        return s[v];
      }
      function f(v, p) {
        s[v] = p;
      }
      var h = o.controllerVisuals[a || o.getValueState(e)], c = Ot.prepareVisualTypes(h);
      return T(c, function(v) {
        var p = h[v];
        n.convertOpacityToAlpha && v === "opacity" && (v = "colorAlpha", p = h.__alphaForOpacity), Ot.dependsOn(v, i) && p && p.applyVisual(e, u, f);
      }), s[i];
    }, t.prototype.positionGroup = function(e) {
      var i = this.visualMapModel, n = this.api;
      mx(e, i.getBoxLayoutParams(), {
        width: n.getWidth(),
        height: n.getHeight()
      });
    }, t.prototype.doRender = function(e, i, n, a) {
    }, t.type = "visualMap", t;
  })(kt)
), ug = [["left", "right", "width"], ["top", "bottom", "height"]];
function C_(r, t, e) {
  var i = r.option, n = i.align;
  if (n != null && n !== "auto")
    return n;
  for (var a = {
    width: t.getWidth(),
    height: t.getHeight()
  }, o = i.orient === "horizontal" ? 1 : 0, s = ug[o], l = [0, null, 10], u = {}, f = 0; f < 3; f++)
    u[ug[1 - o][f]] = l[f], u[s[f]] = f === 2 ? e[0] : i[s[f]];
  var h = [["x", "width", 3], ["y", "height", 0]][o], c = Ar(u, a, i.padding);
  return s[(c.margin[h[2]] || 0) + c[h[0]] + c[h[1]] * 0.5 < a[h[1]] * 0.5 ? 0 : 1];
}
function Ho(r, t) {
  return T(r || [], function(e) {
    e.dataIndex != null && (e.dataIndexInside = e.dataIndex, e.dataIndex = null), e.highlightKey = "visualMap" + (t ? t.componentIndex : "");
  }), r;
}
var Ve = Ye, qL = T, fg = Math.min, Iu = Math.max, KL = 12, QL = 6, JL = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e._shapes = {}, e._dataInterval = [], e._handleEnds = [], e._hoverLinkDataIndices = [], e;
    }
    return t.prototype.init = function(e, i) {
      r.prototype.init.call(this, e, i), this._hoverLinkFromSeriesMouseOver = Q(this._hoverLinkFromSeriesMouseOver, this), this._hideIndicator = Q(this._hideIndicator, this);
    }, t.prototype.doRender = function(e, i, n, a) {
      (!a || a.type !== "selectDataRange" || a.from !== this.uid) && this._buildView();
    }, t.prototype._buildView = function() {
      this.group.removeAll();
      var e = this.visualMapModel, i = this.group;
      this._orient = e.get("orient"), this._useHandle = e.get("calculable"), this._resetInterval(), this._renderBar(i);
      var n = e.get("text");
      this._renderEndsText(i, n, 0), this._renderEndsText(i, n, 1), this._updateView(!0), this.renderBackground(i), this._updateView(), this._enableHoverLinkToSeries(), this._enableHoverLinkFromSeries(), this.positionGroup(i);
    }, t.prototype._renderEndsText = function(e, i, n) {
      if (i) {
        var a = i[1 - n];
        a = a != null ? a + "" : "";
        var o = this.visualMapModel, s = o.get("textGap"), l = o.itemSize, u = this._shapes.mainGroup, f = this._applyTransform([l[0] / 2, n === 0 ? -s : l[1] + s], u), h = this._applyTransform(n === 0 ? "bottom" : "top", u), c = this._orient, v = this.visualMapModel.textStyleModel;
        this.group.add(new mt({
          style: re(v, {
            x: f[0],
            y: f[1],
            verticalAlign: c === "horizontal" ? "middle" : h,
            align: c === "horizontal" ? h : "center",
            text: a
          })
        }));
      }
    }, t.prototype._renderBar = function(e) {
      var i = this.visualMapModel, n = this._shapes, a = i.itemSize, o = this._orient, s = this._useHandle, l = C_(i, this.api, a), u = n.mainGroup = this._createBarGroup(l), f = new gt();
      u.add(f), f.add(n.outOfRange = hg()), f.add(n.inRange = hg(null, s ? cg(this._orient) : null, Q(this._dragHandle, this, "all", !1), Q(this._dragHandle, this, "all", !0))), f.setClipPath(new dt({
        shape: {
          x: 0,
          y: 0,
          width: a[0],
          height: a[1],
          r: 3
        }
      }));
      var h = i.textStyleModel.getTextRect("国"), c = Iu(h.width, h.height);
      s && (n.handleThumbs = [], n.handleLabels = [], n.handleLabelPoints = [], this._createHandle(i, u, 0, a, c, o), this._createHandle(i, u, 1, a, c, o)), this._createIndicator(i, u, a, c, o), e.add(u);
    }, t.prototype._createHandle = function(e, i, n, a, o, s) {
      var l = Q(this._dragHandle, this, n, !1), u = Q(this._dragHandle, this, n, !0), f = Ue(e.get("handleSize"), a[0]), h = ge(e.get("handleIcon"), -f / 2, -f / 2, f, f, null, !0), c = cg(this._orient);
      h.attr({
        cursor: c,
        draggable: !0,
        drift: l,
        ondragend: u,
        onmousemove: function(y) {
          jn(y.event);
        }
      }), h.x = a[0] / 2, h.useStyle(e.getModel("handleStyle").getItemStyle()), h.setStyle({
        strokeNoScale: !0,
        strokeFirst: !0
      }), h.style.lineWidth *= 2, h.ensureState("emphasis").style = e.getModel(["emphasis", "handleStyle"]).getItemStyle(), _h(h, !0), i.add(h);
      var v = this.visualMapModel.textStyleModel, p = new mt({
        cursor: c,
        draggable: !0,
        drift: l,
        onmousemove: function(y) {
          jn(y.event);
        },
        ondragend: u,
        style: re(v, {
          x: 0,
          y: 0,
          text: ""
        })
      });
      p.ensureState("blur").style = {
        opacity: 0.1
      }, p.stateTransition = {
        duration: 200
      }, this.group.add(p);
      var g = [f, 0], d = this._shapes;
      d.handleThumbs[n] = h, d.handleLabelPoints[n] = g, d.handleLabels[n] = p;
    }, t.prototype._createIndicator = function(e, i, n, a, o) {
      var s = Ue(e.get("indicatorSize"), n[0]), l = ge(e.get("indicatorIcon"), -s / 2, -s / 2, s, s, null, !0);
      l.attr({
        cursor: "move",
        invisible: !0,
        silent: !0,
        x: n[0] / 2
      });
      var u = e.getModel("indicatorStyle").getItemStyle();
      if (l instanceof ke) {
        var f = l.style;
        l.useStyle(k({
          // TODO other properties like x, y ?
          image: f.image,
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height
        }, u));
      } else
        l.useStyle(u);
      i.add(l);
      var h = this.visualMapModel.textStyleModel, c = new mt({
        silent: !0,
        invisible: !0,
        style: re(h, {
          x: 0,
          y: 0,
          text: ""
        })
      });
      this.group.add(c);
      var v = [(o === "horizontal" ? a / 2 : QL) + n[0] / 2, 0], p = this._shapes;
      p.indicator = l, p.indicatorLabel = c, p.indicatorLabelPoint = v, this._firstShowIndicator = !0;
    }, t.prototype._dragHandle = function(e, i, n, a) {
      if (this._useHandle) {
        if (this._dragging = !i, !i) {
          var o = this._applyTransform([n, a], this._shapes.mainGroup, !0);
          this._updateInterval(e, o[1]), this._hideIndicator(), this._updateView();
        }
        i === !this.visualMapModel.get("realtime") && this.api.dispatchAction({
          type: "selectDataRange",
          from: this.uid,
          visualMapId: this.visualMapModel.id,
          selected: this._dataInterval.slice()
        }), i ? !this._hovering && this._clearHoverLinkToSeries() : vg(this.visualMapModel) && this._doHoverLinkToSeries(this._handleEnds[e], !1);
      }
    }, t.prototype._resetInterval = function() {
      var e = this.visualMapModel, i = this._dataInterval = e.getSelected(), n = e.getExtent(), a = [0, e.itemSize[1]];
      this._handleEnds = [Ve(i[0], n, a, !0), Ve(i[1], n, a, !0)];
    }, t.prototype._updateInterval = function(e, i) {
      i = i || 0;
      var n = this.visualMapModel, a = this._handleEnds, o = [0, n.itemSize[1]];
      yI(
        i,
        a,
        o,
        e,
        // cross is forbidden
        0
      );
      var s = n.getExtent();
      this._dataInterval = [Ve(a[0], o, s, !0), Ve(a[1], o, s, !0)];
    }, t.prototype._updateView = function(e) {
      var i = this.visualMapModel, n = i.getExtent(), a = this._shapes, o = [0, i.itemSize[1]], s = e ? o : this._handleEnds, l = this._createBarVisual(this._dataInterval, n, s, "inRange"), u = this._createBarVisual(n, n, o, "outOfRange");
      a.inRange.setStyle({
        fill: l.barColor
        // opacity: visualInRange.opacity
      }).setShape("points", l.barPoints), a.outOfRange.setStyle({
        fill: u.barColor
        // opacity: visualOutOfRange.opacity
      }).setShape("points", u.barPoints), this._updateHandle(s, l);
    }, t.prototype._createBarVisual = function(e, i, n, a) {
      var o = {
        forceState: a,
        convertOpacityToAlpha: !0
      }, s = this._makeColorGradient(e, o), l = [this.getControllerVisual(e[0], "symbolSize", o), this.getControllerVisual(e[1], "symbolSize", o)], u = this._createBarPoints(n, l);
      return {
        barColor: new Os(0, 0, 0, 1, s),
        barPoints: u,
        handlesColor: [s[0].color, s[s.length - 1].color]
      };
    }, t.prototype._makeColorGradient = function(e, i) {
      var n = 100, a = [], o = (e[1] - e[0]) / n;
      a.push({
        color: this.getControllerVisual(e[0], "color", i),
        offset: 0
      });
      for (var s = 1; s < n; s++) {
        var l = e[0] + o * s;
        if (l > e[1])
          break;
        a.push({
          color: this.getControllerVisual(l, "color", i),
          offset: s / n
        });
      }
      return a.push({
        color: this.getControllerVisual(e[1], "color", i),
        offset: 1
      }), a;
    }, t.prototype._createBarPoints = function(e, i) {
      var n = this.visualMapModel.itemSize;
      return [[n[0] - i[0], e[0]], [n[0], e[0]], [n[0], e[1]], [n[0] - i[1], e[1]]];
    }, t.prototype._createBarGroup = function(e) {
      var i = this._orient, n = this.visualMapModel.get("inverse");
      return new gt(i === "horizontal" && !n ? {
        scaleX: e === "bottom" ? 1 : -1,
        rotation: Math.PI / 2
      } : i === "horizontal" && n ? {
        scaleX: e === "bottom" ? -1 : 1,
        rotation: -Math.PI / 2
      } : i === "vertical" && !n ? {
        scaleX: e === "left" ? 1 : -1,
        scaleY: -1
      } : {
        scaleX: e === "left" ? 1 : -1
      });
    }, t.prototype._updateHandle = function(e, i) {
      if (this._useHandle) {
        var n = this._shapes, a = this.visualMapModel, o = n.handleThumbs, s = n.handleLabels, l = a.itemSize, u = a.getExtent(), f = this._applyTransform("left", n.mainGroup);
        qL([0, 1], function(h) {
          var c = o[h];
          c.setStyle("fill", i.handlesColor[h]), c.y = e[h];
          var v = Ve(e[h], [0, l[1]], u, !0), p = this.getControllerVisual(v, "symbolSize");
          c.scaleX = c.scaleY = p / l[0], c.x = l[0] - p / 2;
          var g = Yi(n.handleLabelPoints[h], Xn(c, this.group));
          if (this._orient === "horizontal") {
            var d = f === "left" || f === "top" ? (l[0] - p) / 2 : (l[0] - p) / -2;
            g[1] += d;
          }
          s[h].setStyle({
            x: g[0],
            y: g[1],
            text: a.formatValueText(this._dataInterval[h]),
            verticalAlign: "middle",
            align: this._orient === "vertical" ? this._applyTransform("left", n.mainGroup) : "center"
          });
        }, this);
      }
    }, t.prototype._showIndicator = function(e, i, n, a) {
      var o = this.visualMapModel, s = o.getExtent(), l = o.itemSize, u = [0, l[1]], f = this._shapes, h = f.indicator;
      if (h) {
        h.attr("invisible", !1);
        var c = {
          convertOpacityToAlpha: !0
        }, v = this.getControllerVisual(e, "color", c), p = this.getControllerVisual(e, "symbolSize"), g = Ve(e, s, u, !0), d = l[0] - p / 2, y = {
          x: h.x,
          y: h.y
        };
        h.y = g, h.x = d;
        var m = Yi(f.indicatorLabelPoint, Xn(h, this.group)), _ = f.indicatorLabel;
        _.attr("invisible", !1);
        var S = this._applyTransform("left", f.mainGroup), w = this._orient, b = w === "horizontal";
        _.setStyle({
          text: (n || "") + o.formatValueText(i),
          verticalAlign: b ? S : "middle",
          align: b ? "center" : S
        });
        var x = {
          x: d,
          y: g,
          style: {
            fill: v
          }
        }, M = {
          style: {
            x: m[0],
            y: m[1]
          }
        };
        if (o.ecModel.isAnimationEnabled() && !this._firstShowIndicator) {
          var D = {
            duration: 100,
            easing: "cubicInOut",
            additive: !0
          };
          h.x = y.x, h.y = y.y, h.animateTo(x, D), _.animateTo(M, D);
        } else
          h.attr(x), _.attr(M);
        this._firstShowIndicator = !1;
        var A = this._shapes.handleLabels;
        if (A)
          for (var C = 0; C < A.length; C++)
            this.api.enterBlur(A[C]);
      }
    }, t.prototype._enableHoverLinkToSeries = function() {
      var e = this;
      this._shapes.mainGroup.on("mousemove", function(i) {
        if (e._hovering = !0, !e._dragging) {
          var n = e.visualMapModel.itemSize, a = e._applyTransform([i.offsetX, i.offsetY], e._shapes.mainGroup, !0, !0);
          a[1] = fg(Iu(0, a[1]), n[1]), e._doHoverLinkToSeries(a[1], 0 <= a[0] && a[0] <= n[0]);
        }
      }).on("mouseout", function() {
        e._hovering = !1, !e._dragging && e._clearHoverLinkToSeries();
      });
    }, t.prototype._enableHoverLinkFromSeries = function() {
      var e = this.api.getZr();
      this.visualMapModel.option.hoverLink ? (e.on("mouseover", this._hoverLinkFromSeriesMouseOver, this), e.on("mouseout", this._hideIndicator, this)) : this._clearHoverLinkFromSeries();
    }, t.prototype._doHoverLinkToSeries = function(e, i) {
      var n = this.visualMapModel, a = n.itemSize;
      if (n.option.hoverLink) {
        var o = [0, a[1]], s = n.getExtent();
        e = fg(Iu(o[0], e), o[1]);
        var l = jL(n, s, o), u = [e - l, e + l], f = Ve(e, o, s, !0), h = [Ve(u[0], o, s, !0), Ve(u[1], o, s, !0)];
        u[0] < o[0] && (h[0] = -1 / 0), u[1] > o[1] && (h[1] = 1 / 0), i && (h[0] === -1 / 0 ? this._showIndicator(f, h[1], "< ", l) : h[1] === 1 / 0 ? this._showIndicator(f, h[0], "> ", l) : this._showIndicator(f, f, "≈ ", l));
        var c = this._hoverLinkDataIndices, v = [];
        (i || vg(n)) && (v = this._hoverLinkDataIndices = n.findTargetDataIndices(h));
        var p = GS(c, v);
        this._dispatchHighDown("downplay", Ho(p[0], n)), this._dispatchHighDown("highlight", Ho(p[1], n));
      }
    }, t.prototype._hoverLinkFromSeriesMouseOver = function(e) {
      var i;
      if (Gi(e.target, function(l) {
        var u = J(l);
        if (u.dataIndex != null)
          return i = u, !0;
      }, !0), !!i) {
        var n = this.ecModel.getSeriesByIndex(i.seriesIndex), a = this.visualMapModel;
        if (a.isTargetSeries(n)) {
          var o = n.getData(i.dataType), s = o.getStore().get(a.getDataDimensionIndex(o), i.dataIndex);
          isNaN(s) || this._showIndicator(s, s);
        }
      }
    }, t.prototype._hideIndicator = function() {
      var e = this._shapes;
      e.indicator && e.indicator.attr("invisible", !0), e.indicatorLabel && e.indicatorLabel.attr("invisible", !0);
      var i = this._shapes.handleLabels;
      if (i)
        for (var n = 0; n < i.length; n++)
          this.api.leaveBlur(i[n]);
    }, t.prototype._clearHoverLinkToSeries = function() {
      this._hideIndicator();
      var e = this._hoverLinkDataIndices;
      this._dispatchHighDown("downplay", Ho(e, this.visualMapModel)), e.length = 0;
    }, t.prototype._clearHoverLinkFromSeries = function() {
      this._hideIndicator();
      var e = this.api.getZr();
      e.off("mouseover", this._hoverLinkFromSeriesMouseOver), e.off("mouseout", this._hideIndicator);
    }, t.prototype._applyTransform = function(e, i, n, a) {
      var o = Xn(i, a ? null : this.group);
      return O(e) ? Yi(e, o, n) : Gy(e, o, n);
    }, t.prototype._dispatchHighDown = function(e, i) {
      i && i.length && this.api.dispatchAction({
        type: e,
        batch: i
      });
    }, t.prototype.dispose = function() {
      this._clearHoverLinkFromSeries(), this._clearHoverLinkToSeries();
    }, t.type = "visualMap.continuous", t;
  })(T_)
);
function hg(r, t, e, i) {
  return new Aa({
    shape: {
      points: r
    },
    draggable: !!e,
    cursor: t,
    drift: e,
    onmousemove: function(n) {
      jn(n.event);
    },
    ondragend: i
  });
}
function jL(r, t, e) {
  var i = KL / 2, n = r.get("hoverLinkDataSize");
  return n && (i = Ve(n, t, e, !0) / 2), i;
}
function vg(r) {
  var t = r.get("hoverLinkOnHandle");
  return !!(t ?? r.get("realtime"));
}
function cg(r) {
  return r === "vertical" ? "ns-resize" : "ew-resize";
}
var t2 = {
  type: "selectDataRange",
  event: "dataRangeSelected",
  // FIXME use updateView appears wrong
  update: "update"
}, e2 = function(r, t) {
  t.eachComponent({
    mainType: "visualMap",
    query: r
  }, function(e) {
    e.setSelected(r.selected);
  });
}, r2 = [
  {
    createOnAllSeries: !0,
    reset: function(r, t) {
      var e = [];
      return t.eachComponent("visualMap", function(i) {
        var n = r.pipelineContext;
        !i.isTargetSeries(r) || n && n.large || e.push(yL(i.stateList, i.targetVisuals, Q(i.getValueState, i), i.getDataDimensionIndex(r.getData())));
      }), e;
    }
  },
  // Only support color.
  {
    createOnAllSeries: !0,
    reset: function(r, t) {
      var e = r.getData(), i = [];
      t.eachComponent("visualMap", function(n) {
        if (n.isTargetSeries(r)) {
          var a = n.getVisualMeta(Q(i2, null, r, n)) || {
            stops: [],
            outerColors: []
          }, o = n.getDataDimensionIndex(e);
          o >= 0 && (a.dimension = o, i.push(a));
        }
      }), r.getData().setVisual("visualMeta", i);
    }
  }
];
function i2(r, t, e, i) {
  for (var n = t.targetVisuals[i], a = Ot.prepareVisualTypes(n), o = {
    color: Vh(r.getData(), "color")
    // default color.
  }, s = 0, l = a.length; s < l; s++) {
    var u = a[s], f = n[u === "opacity" ? "__alphaForOpacity" : u];
    f && f.applyVisual(e, h, c);
  }
  return o.color;
  function h(v) {
    return o[v];
  }
  function c(v, p) {
    o[v] = p;
  }
}
var pg = T;
function n2(r) {
  var t = r && r.visualMap;
  O(t) || (t = t ? [t] : []), pg(t, function(e) {
    if (e) {
      Bi(e, "splitList") && !Bi(e, "pieces") && (e.pieces = e.splitList, delete e.splitList);
      var i = e.pieces;
      i && O(i) && pg(i, function(n) {
        H(n) && (Bi(n, "start") && !Bi(n, "min") && (n.min = n.start), Bi(n, "end") && !Bi(n, "max") && (n.max = n.end));
      });
    }
  });
}
function Bi(r, t) {
  return r && r.hasOwnProperty && r.hasOwnProperty(t);
}
var dg = !1;
function M_(r) {
  dg || (dg = !0, r.registerSubTypeDefaulter("visualMap", function(t) {
    return !t.categories && (!(t.pieces ? t.pieces.length > 0 : t.splitNumber > 0) || t.calculable) ? "continuous" : "piecewise";
  }), r.registerAction(t2, e2), T(r2, function(t) {
    r.registerVisual(r.PRIORITY.VISUAL.COMPONENT, t);
  }), r.registerPreprocessor(n2));
}
function a2(r) {
  r.registerComponentModel(ZL), r.registerComponentView(JL), M_(r);
}
var o2 = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e._pieceList = [], e;
    }
    return t.prototype.optionUpdated = function(e, i) {
      r.prototype.optionUpdated.apply(this, arguments), this.resetExtent();
      var n = this._mode = this._determineMode();
      this._pieceList = [], s2[this._mode].call(this, this._pieceList), this._resetSelected(e, i);
      var a = this.option.categories;
      this.resetVisual(function(o, s) {
        n === "categories" ? (o.mappingMethod = "category", o.categories = U(a)) : (o.dataExtent = this.getExtent(), o.mappingMethod = "piecewise", o.pieceList = z(this._pieceList, function(l) {
          return l = U(l), s !== "inRange" && (l.visual = null), l;
        }));
      });
    }, t.prototype.completeVisualOption = function() {
      var e = this.option, i = {}, n = Ot.listVisualTypes(), a = this.isCategory();
      T(e.pieces, function(s) {
        T(n, function(l) {
          s.hasOwnProperty(l) && (i[l] = 1);
        });
      }), T(i, function(s, l) {
        var u = !1;
        T(this.stateList, function(f) {
          u = u || o(e, f, l) || o(e.target, f, l);
        }, this), !u && T(this.stateList, function(f) {
          (e[f] || (e[f] = {}))[l] = x_.get(l, f === "inRange" ? "active" : "inactive", a);
        });
      }, this);
      function o(s, l, u) {
        return s && s[l] && s[l].hasOwnProperty(u);
      }
      r.prototype.completeVisualOption.apply(this, arguments);
    }, t.prototype._resetSelected = function(e, i) {
      var n = this.option, a = this._pieceList, o = (i ? n : e).selected || {};
      if (n.selected = o, T(a, function(l, u) {
        var f = this.getSelectedMapKey(l);
        o.hasOwnProperty(f) || (o[f] = !0);
      }, this), n.selectedMode === "single") {
        var s = !1;
        T(a, function(l, u) {
          var f = this.getSelectedMapKey(l);
          o[f] && (s ? o[f] = !1 : s = !0);
        }, this);
      }
    }, t.prototype.getItemSymbol = function() {
      return this.get("itemSymbol");
    }, t.prototype.getSelectedMapKey = function(e) {
      return this._mode === "categories" ? e.value + "" : e.index + "";
    }, t.prototype.getPieceList = function() {
      return this._pieceList;
    }, t.prototype._determineMode = function() {
      var e = this.option;
      return e.pieces && e.pieces.length > 0 ? "pieces" : this.option.categories ? "categories" : "splitNumber";
    }, t.prototype.setSelected = function(e) {
      this.option.selected = U(e);
    }, t.prototype.getValueState = function(e) {
      var i = Ot.findPieceIndex(e, this._pieceList);
      return i != null && this.option.selected[this.getSelectedMapKey(this._pieceList[i])] ? "inRange" : "outOfRange";
    }, t.prototype.findTargetDataIndices = function(e) {
      var i = [], n = this._pieceList;
      return this.eachTargetSeries(function(a) {
        var o = [], s = a.getData();
        s.each(this.getDataDimensionIndex(s), function(l, u) {
          var f = Ot.findPieceIndex(l, n);
          f === e && o.push(u);
        }, this), i.push({
          seriesId: a.id,
          dataIndex: o
        });
      }, this), i;
    }, t.prototype.getRepresentValue = function(e) {
      var i;
      if (this.isCategory())
        i = e.value;
      else if (e.value != null)
        i = e.value;
      else {
        var n = e.interval || [];
        i = n[0] === -1 / 0 && n[1] === 1 / 0 ? 0 : (n[0] + n[1]) / 2;
      }
      return i;
    }, t.prototype.getVisualMeta = function(e) {
      if (this.isCategory())
        return;
      var i = [], n = ["", ""], a = this;
      function o(f, h) {
        var c = a.getRepresentValue({
          interval: f
        });
        h || (h = a.getValueState(c));
        var v = e(c, h);
        f[0] === -1 / 0 ? n[0] = v : f[1] === 1 / 0 ? n[1] = v : i.push({
          value: f[0],
          color: v
        }, {
          value: f[1],
          color: v
        });
      }
      var s = this._pieceList.slice();
      if (!s.length)
        s.push({
          interval: [-1 / 0, 1 / 0]
        });
      else {
        var l = s[0].interval[0];
        l !== -1 / 0 && s.unshift({
          interval: [-1 / 0, l]
        }), l = s[s.length - 1].interval[1], l !== 1 / 0 && s.push({
          interval: [l, 1 / 0]
        });
      }
      var u = -1 / 0;
      return T(s, function(f) {
        var h = f.interval;
        h && (h[0] > u && o([u, h[0]], "outOfRange"), o(h.slice()), u = h[1]);
      }, this), {
        stops: i,
        outerColors: n
      };
    }, t.type = "visualMap.piecewise", t.defaultOption = Hs(gs.defaultOption, {
      selected: null,
      minOpen: !1,
      maxOpen: !1,
      align: "auto",
      itemWidth: 20,
      itemHeight: 14,
      itemSymbol: "roundRect",
      pieces: null,
      categories: null,
      splitNumber: 5,
      selectedMode: "multiple",
      itemGap: 10,
      hoverLink: !0
      // Enable hover highlight.
    }), t;
  })(gs)
), s2 = {
  splitNumber: function(r) {
    var t = this.option, e = Math.min(t.precision, 20), i = this.getExtent(), n = t.splitNumber;
    n = Math.max(parseInt(n, 10), 1), t.splitNumber = n;
    for (var a = (i[1] - i[0]) / n; +a.toFixed(e) !== a && e < 5; )
      e++;
    t.precision = e, a = +a.toFixed(e), t.minOpen && r.push({
      interval: [-1 / 0, i[0]],
      close: [0, 0]
    });
    for (var o = 0, s = i[0]; o < n; s += a, o++) {
      var l = o === n - 1 ? i[1] : s + a;
      r.push({
        interval: [s, l],
        close: [1, 1]
      });
    }
    t.maxOpen && r.push({
      interval: [i[1], 1 / 0],
      close: [0, 0]
    }), Ju(r), T(r, function(u, f) {
      u.index = f, u.text = this.formatValueText(u.interval);
    }, this);
  },
  categories: function(r) {
    var t = this.option;
    T(t.categories, function(e) {
      r.push({
        text: this.formatValueText(e, !0),
        value: e
      });
    }, this), gg(t, r);
  },
  pieces: function(r) {
    var t = this.option;
    T(t.pieces, function(e, i) {
      H(e) || (e = {
        value: e
      });
      var n = {
        text: "",
        index: i
      };
      if (e.label != null && (n.text = e.label), e.hasOwnProperty("value")) {
        var a = n.value = e.value;
        n.interval = [a, a], n.close = [1, 1];
      } else {
        for (var o = n.interval = [], s = n.close = [0, 0], l = [1, 0, 1], u = [-1 / 0, 1 / 0], f = [], h = 0; h < 2; h++) {
          for (var c = [["gte", "gt", "min"], ["lte", "lt", "max"]][h], v = 0; v < 3 && o[h] == null; v++)
            o[h] = e[c[v]], s[h] = l[v], f[h] = v === 2;
          o[h] == null && (o[h] = u[h]);
        }
        f[0] && o[1] === 1 / 0 && (s[0] = 0), f[1] && o[0] === -1 / 0 && (s[1] = 0), o[0] === o[1] && s[0] && s[1] && (n.value = o[0]);
      }
      n.visual = Ot.retrieveVisuals(e), r.push(n);
    }, this), gg(t, r), Ju(r), T(r, function(e) {
      var i = e.close, n = [["<", "≤"][i[1]], [">", "≥"][i[0]]];
      e.text = e.text || this.formatValueText(e.value != null ? e.value : e.interval, !1, n);
    }, this);
  }
};
function gg(r, t) {
  var e = r.inverse;
  (r.orient === "vertical" ? !e : e) && t.reverse();
}
var l2 = (
  /** @class */
  (function(r) {
    F(t, r);
    function t() {
      var e = r !== null && r.apply(this, arguments) || this;
      return e.type = t.type, e;
    }
    return t.prototype.doRender = function() {
      var e = this.group;
      e.removeAll();
      var i = this.visualMapModel, n = i.get("textGap"), a = i.textStyleModel, o = a.getFont(), s = a.getTextColor(), l = this._getItemAlign(), u = i.itemSize, f = this._getViewData(), h = f.endsText, c = Cr(i.get("showLabel", !0), !h), v = !i.get("selectedMode");
      h && this._renderEndsText(e, h[0], u, c, l), T(f.viewPieceList, function(p) {
        var g = p.piece, d = new gt();
        d.onclick = Q(this._onItemClick, this, g), this._enableHoverLink(d, p.indexInModelPieceList);
        var y = i.getRepresentValue(g);
        if (this._createItemSymbol(d, y, [0, 0, u[0], u[1]], v), c) {
          var m = this.visualMapModel.getValueState(y);
          d.add(new mt({
            style: {
              x: l === "right" ? -n : u[0] + n,
              y: u[1] / 2,
              text: g.text,
              verticalAlign: "middle",
              align: l,
              font: o,
              fill: s,
              opacity: m === "outOfRange" ? 0.5 : 1
            },
            silent: v
          }));
        }
        e.add(d);
      }, this), h && this._renderEndsText(e, h[1], u, c, l), qi(i.get("orient"), e, i.get("itemGap")), this.renderBackground(e), this.positionGroup(e);
    }, t.prototype._enableHoverLink = function(e, i) {
      var n = this;
      e.on("mouseover", function() {
        return a("highlight");
      }).on("mouseout", function() {
        return a("downplay");
      });
      var a = function(o) {
        var s = n.visualMapModel;
        s.option.hoverLink && n.api.dispatchAction({
          type: o,
          batch: Ho(s.findTargetDataIndices(i), s)
        });
      };
    }, t.prototype._getItemAlign = function() {
      var e = this.visualMapModel, i = e.option;
      if (i.orient === "vertical")
        return C_(e, this.api, e.itemSize);
      var n = i.align;
      return (!n || n === "auto") && (n = "left"), n;
    }, t.prototype._renderEndsText = function(e, i, n, a, o) {
      if (i) {
        var s = new gt(), l = this.visualMapModel.textStyleModel;
        s.add(new mt({
          style: re(l, {
            x: a ? o === "right" ? n[0] : 0 : n[0] / 2,
            y: n[1] / 2,
            verticalAlign: "middle",
            align: a ? o : "center",
            text: i
          })
        })), e.add(s);
      }
    }, t.prototype._getViewData = function() {
      var e = this.visualMapModel, i = z(e.getPieceList(), function(s, l) {
        return {
          piece: s,
          indexInModelPieceList: l
        };
      }), n = e.get("text"), a = e.get("orient"), o = e.get("inverse");
      return (a === "horizontal" ? o : !o) ? i.reverse() : n && (n = n.slice().reverse()), {
        viewPieceList: i,
        endsText: n
      };
    }, t.prototype._createItemSymbol = function(e, i, n, a) {
      var o = ge(
        // symbol will be string
        this.getControllerVisual(i, "symbol"),
        n[0],
        n[1],
        n[2],
        n[3],
        // color will be string
        this.getControllerVisual(i, "color")
      );
      o.silent = a, e.add(o);
    }, t.prototype._onItemClick = function(e) {
      var i = this.visualMapModel, n = i.option, a = n.selectedMode;
      if (a) {
        var o = U(n.selected), s = i.getSelectedMapKey(e);
        a === "single" || a === !0 ? (o[s] = !0, T(o, function(l, u) {
          o[u] = u === s;
        })) : o[s] = !o[s], this.api.dispatchAction({
          type: "selectDataRange",
          from: this.uid,
          visualMapId: this.visualMapModel.id,
          selected: o
        });
      }
    }, t.type = "visualMap.piecewise", t;
  })(T_)
);
function u2(r) {
  r.registerComponentModel(o2), r.registerComponentView(l2), M_(r);
}
function f2(r) {
  ye(a2), ye(u2);
}
function yg(r, t, e) {
  var i = Re.createCanvas(), n = t.getWidth(), a = t.getHeight(), o = i.style;
  return o && (o.position = "absolute", o.left = "0", o.top = "0", o.width = n + "px", o.height = a + "px", i.setAttribute("data-zr-dom-id", r)), i.width = n * e, i.height = a * e, i;
}
var Lu = (function(r) {
  ut(t, r);
  function t(e, i, n) {
    var a = r.call(this) || this;
    a.motionBlur = !1, a.lastFrameAlpha = 0.7, a.dpr = 1, a.virtual = !1, a.config = {}, a.incremental = !1, a.zlevel = 0, a.maxRepaintRectCount = 5, a.__dirty = !0, a.__firstTimePaint = !0, a.__used = !1, a.__drawIndex = 0, a.__startIndex = 0, a.__endIndex = 0, a.__prevStartIndex = null, a.__prevEndIndex = null;
    var o;
    n = n || Qo, typeof e == "string" ? o = yg(e, i, n) : H(e) && (o = e, e = o.id), a.id = e, a.dom = o;
    var s = o.style;
    return s && (Qf(o), o.onselectstart = function() {
      return !1;
    }, s.padding = "0", s.margin = "0", s.borderWidth = "0"), a.painter = i, a.dpr = n, a;
  }
  return t.prototype.getElementCount = function() {
    return this.__endIndex - this.__startIndex;
  }, t.prototype.afterBrush = function() {
    this.__prevStartIndex = this.__startIndex, this.__prevEndIndex = this.__endIndex;
  }, t.prototype.initContext = function() {
    this.ctx = this.dom.getContext("2d"), this.ctx.dpr = this.dpr;
  }, t.prototype.setUnpainted = function() {
    this.__firstTimePaint = !0;
  }, t.prototype.createBackBuffer = function() {
    var e = this.dpr;
    this.domBack = yg("back-" + this.id, this.painter, e), this.ctxBack = this.domBack.getContext("2d"), e !== 1 && this.ctxBack.scale(e, e);
  }, t.prototype.createRepaintRects = function(e, i, n, a) {
    if (this.__firstTimePaint)
      return this.__firstTimePaint = !1, null;
    var o = [], s = this.maxRepaintRectCount, l = !1, u = new it(0, 0, 0, 0);
    function f(m) {
      if (!(!m.isFinite() || m.isZero()))
        if (o.length === 0) {
          var _ = new it(0, 0, 0, 0);
          _.copy(m), o.push(_);
        } else {
          for (var S = !1, w = 1 / 0, b = 0, x = 0; x < o.length; ++x) {
            var M = o[x];
            if (M.intersect(m)) {
              var D = new it(0, 0, 0, 0);
              D.copy(M), D.union(m), o[x] = D, S = !0;
              break;
            } else if (l) {
              u.copy(m), u.union(M);
              var A = m.width * m.height, C = M.width * M.height, I = u.width * u.height, L = I - A - C;
              L < w && (w = L, b = x);
            }
          }
          if (l && (o[b].union(m), S = !0), !S) {
            var _ = new it(0, 0, 0, 0);
            _.copy(m), o.push(_);
          }
          l || (l = o.length >= s);
        }
    }
    for (var h = this.__startIndex; h < this.__endIndex; ++h) {
      var c = e[h];
      if (c) {
        var v = c.shouldBePainted(n, a, !0, !0), p = c.__isRendered && (c.__dirty & te || !v) ? c.getPrevPaintRect() : null;
        p && f(p);
        var g = v && (c.__dirty & te || !c.__isRendered) ? c.getPaintRect() : null;
        g && f(g);
      }
    }
    for (var h = this.__prevStartIndex; h < this.__prevEndIndex; ++h) {
      var c = i[h], v = c && c.shouldBePainted(n, a, !0, !0);
      if (c && (!v || !c.__zr) && c.__isRendered) {
        var p = c.getPrevPaintRect();
        p && f(p);
      }
    }
    var d;
    do {
      d = !1;
      for (var h = 0; h < o.length; ) {
        if (o[h].isZero()) {
          o.splice(h, 1);
          continue;
        }
        for (var y = h + 1; y < o.length; )
          o[h].intersect(o[y]) ? (d = !0, o[h].union(o[y]), o.splice(y, 1)) : y++;
        h++;
      }
    } while (d);
    return this._paintRects = o, o;
  }, t.prototype.debugGetPaintRects = function() {
    return (this._paintRects || []).slice();
  }, t.prototype.resize = function(e, i) {
    var n = this.dpr, a = this.dom, o = a.style, s = this.domBack;
    o && (o.width = e + "px", o.height = i + "px"), a.width = e * n, a.height = i * n, s && (s.width = e * n, s.height = i * n, n !== 1 && this.ctxBack.scale(n, n));
  }, t.prototype.clear = function(e, i, n) {
    var a = this.dom, o = this.ctx, s = a.width, l = a.height;
    i = i || this.clearColor;
    var u = this.motionBlur && !e, f = this.lastFrameAlpha, h = this.dpr, c = this;
    u && (this.domBack || this.createBackBuffer(), this.ctxBack.globalCompositeOperation = "copy", this.ctxBack.drawImage(a, 0, 0, s / h, l / h));
    var v = this.domBack;
    function p(g, d, y, m) {
      if (o.clearRect(g, d, y, m), i && i !== "transparent") {
        var _ = void 0;
        if (_a(i)) {
          var S = i.global || i.__width === y && i.__height === m;
          _ = S && i.__canvasGradient || bf(o, i, {
            x: 0,
            y: 0,
            width: y,
            height: m
          }), i.__canvasGradient = _, i.__width = y, i.__height = m;
        } else wg(i) && (i.scaleX = i.scaleX || h, i.scaleY = i.scaleY || h, _ = wf(o, i, {
          dirty: function() {
            c.setUnpainted(), c.painter.refresh();
          }
        }));
        o.save(), o.fillStyle = _ || i, o.fillRect(g, d, y, m), o.restore();
      }
      u && (o.save(), o.globalAlpha = f, o.drawImage(v, g, d, y, m), o.restore());
    }
    !n || u ? p(0, 0, s, l) : n.length && T(n, function(g) {
      p(g.x * h, g.y * h, g.width * h, g.height * h);
    });
  }, t;
})($e), mg = 1e5, jr = 314159, Mo = 0.01, h2 = 1e-3;
function v2(r) {
  return r ? r.__builtin__ ? !0 : !(typeof r.resize != "function" || typeof r.refresh != "function") : !1;
}
function c2(r, t) {
  var e = document.createElement("div");
  return e.style.cssText = [
    "position:relative",
    "width:" + r + "px",
    "height:" + t + "px",
    "padding:0",
    "margin:0",
    "border-width:0"
  ].join(";") + ";", e;
}
var p2 = (function() {
  function r(t, e, i, n) {
    this.type = "canvas", this._zlevelList = [], this._prevDisplayList = [], this._layers = {}, this._layerConfig = {}, this._needsManuallyCompositing = !1, this.type = "canvas";
    var a = !t.nodeName || t.nodeName.toUpperCase() === "CANVAS";
    this._opts = i = k({}, i || {}), this.dpr = i.devicePixelRatio || Qo, this._singleCanvas = a, this.root = t;
    var o = t.style;
    o && (Qf(t), t.innerHTML = ""), this.storage = e;
    var s = this._zlevelList;
    this._prevDisplayList = [];
    var l = this._layers;
    if (a) {
      var f = t, h = f.width, c = f.height;
      i.width != null && (h = i.width), i.height != null && (c = i.height), this.dpr = i.devicePixelRatio || 1, f.width = h * this.dpr, f.height = c * this.dpr, this._width = h, this._height = c;
      var v = new Lu(f, this, this.dpr);
      v.__builtin__ = !0, v.initContext(), l[jr] = v, v.zlevel = jr, s.push(jr), this._domRoot = t;
    } else {
      this._width = so(t, 0, i), this._height = so(t, 1, i);
      var u = this._domRoot = c2(this._width, this._height);
      t.appendChild(u);
    }
  }
  return r.prototype.getType = function() {
    return "canvas";
  }, r.prototype.isSingleCanvas = function() {
    return this._singleCanvas;
  }, r.prototype.getViewportRoot = function() {
    return this._domRoot;
  }, r.prototype.getViewportRootOffset = function() {
    var t = this.getViewportRoot();
    if (t)
      return {
        offsetLeft: t.offsetLeft || 0,
        offsetTop: t.offsetTop || 0
      };
  }, r.prototype.refresh = function(t) {
    var e = this.storage.getDisplayList(!0), i = this._prevDisplayList, n = this._zlevelList;
    this._redrawId = Math.random(), this._paintList(e, i, t, this._redrawId);
    for (var a = 0; a < n.length; a++) {
      var o = n[a], s = this._layers[o];
      if (!s.__builtin__ && s.refresh) {
        var l = a === 0 ? this._backgroundColor : null;
        s.refresh(l);
      }
    }
    return this._opts.useDirtyRect && (this._prevDisplayList = e.slice()), this;
  }, r.prototype.refreshHover = function() {
    this._paintHoverList(this.storage.getDisplayList(!1));
  }, r.prototype._paintHoverList = function(t) {
    var e = t.length, i = this._hoverlayer;
    if (i && i.clear(), !!e) {
      for (var n = {
        inHover: !0,
        viewWidth: this._width,
        viewHeight: this._height
      }, a, o = 0; o < e; o++) {
        var s = t[o];
        s.__inHover && (i || (i = this._hoverlayer = this.getLayer(mg)), a || (a = i.ctx, a.save()), ai(a, s, n, o === e - 1));
      }
      a && a.restore();
    }
  }, r.prototype.getHoverLayer = function() {
    return this.getLayer(mg);
  }, r.prototype.paintOne = function(t, e) {
    Gh(t, e);
  }, r.prototype._paintList = function(t, e, i, n) {
    if (this._redrawId === n) {
      i = i || !1, this._updateLayerStatus(t);
      var a = this._doPaintList(t, e, i), o = a.finished, s = a.needsRefreshHover;
      if (this._needsManuallyCompositing && this._compositeManually(), s && this._paintHoverList(t), o)
        this.eachLayer(function(u) {
          u.afterBrush && u.afterBrush();
        });
      else {
        var l = this;
        Xo(function() {
          l._paintList(t, e, i, n);
        });
      }
    }
  }, r.prototype._compositeManually = function() {
    var t = this.getLayer(jr).ctx, e = this._domRoot.width, i = this._domRoot.height;
    t.clearRect(0, 0, e, i), this.eachBuiltinLayer(function(n) {
      n.virtual && t.drawImage(n.dom, 0, 0, e, i);
    });
  }, r.prototype._doPaintList = function(t, e, i) {
    for (var n = this, a = [], o = this._opts.useDirtyRect, s = 0; s < this._zlevelList.length; s++) {
      var l = this._zlevelList[s], u = this._layers[l];
      u.__builtin__ && u !== this._hoverlayer && (u.__dirty || i) && a.push(u);
    }
    for (var f = !0, h = !1, c = function(g) {
      var d = a[g], y = d.ctx, m = o && d.createRepaintRects(t, e, v._width, v._height), _ = i ? d.__startIndex : d.__drawIndex, S = !i && d.incremental && Date.now, w = S && Date.now(), b = d.zlevel === v._zlevelList[0] ? v._backgroundColor : null;
      if (d.__startIndex === d.__endIndex)
        d.clear(!1, b, m);
      else if (_ === d.__startIndex) {
        var x = t[_];
        (!x.incremental || !x.notClear || i) && d.clear(!1, b, m);
      }
      _ === -1 && (console.error("For some unknown reason. drawIndex is -1"), _ = d.__startIndex);
      var M, D = function(L) {
        var P = {
          inHover: !1,
          allClipped: !1,
          prevEl: null,
          viewWidth: n._width,
          viewHeight: n._height
        };
        for (M = _; M < d.__endIndex; M++) {
          var R = t[M];
          if (R.__inHover && (h = !0), n._doPaintEl(R, d, o, L, P, M === d.__endIndex - 1), S) {
            var E = Date.now() - w;
            if (E > 15)
              break;
          }
        }
        P.prevElClipPaths && y.restore();
      };
      if (m)
        if (m.length === 0)
          M = d.__endIndex;
        else
          for (var A = v.dpr, C = 0; C < m.length; ++C) {
            var I = m[C];
            y.save(), y.beginPath(), y.rect(I.x * A, I.y * A, I.width * A, I.height * A), y.clip(), D(I), y.restore();
          }
      else
        y.save(), D(), y.restore();
      d.__drawIndex = M, d.__drawIndex < d.__endIndex && (f = !1);
    }, v = this, p = 0; p < a.length; p++)
      c(p);
    return Y.wxa && T(this._layers, function(g) {
      g && g.ctx && g.ctx.draw && g.ctx.draw();
    }), {
      finished: f,
      needsRefreshHover: h
    };
  }, r.prototype._doPaintEl = function(t, e, i, n, a, o) {
    var s = e.ctx;
    if (i) {
      var l = t.getPaintRect();
      (!n || l && l.intersect(n)) && (ai(s, t, a, o), t.setPrevPaintRect(l));
    } else
      ai(s, t, a, o);
  }, r.prototype.getLayer = function(t, e) {
    this._singleCanvas && !this._needsManuallyCompositing && (t = jr);
    var i = this._layers[t];
    return i || (i = new Lu("zr_" + t, this, this.dpr), i.zlevel = t, i.__builtin__ = !0, this._layerConfig[t] ? j(i, this._layerConfig[t], !0) : this._layerConfig[t - Mo] && j(i, this._layerConfig[t - Mo], !0), e && (i.virtual = e), this.insertLayer(t, i), i.initContext()), i;
  }, r.prototype.insertLayer = function(t, e) {
    var i = this._layers, n = this._zlevelList, a = n.length, o = this._domRoot, s = null, l = -1;
    if (!i[t] && v2(e)) {
      if (a > 0 && t > n[0]) {
        for (l = 0; l < a - 1 && !(n[l] < t && n[l + 1] > t); l++)
          ;
        s = i[n[l]];
      }
      if (n.splice(l + 1, 0, t), i[t] = e, !e.virtual)
        if (s) {
          var u = s.dom;
          u.nextSibling ? o.insertBefore(e.dom, u.nextSibling) : o.appendChild(e.dom);
        } else
          o.firstChild ? o.insertBefore(e.dom, o.firstChild) : o.appendChild(e.dom);
      e.painter || (e.painter = this);
    }
  }, r.prototype.eachLayer = function(t, e) {
    for (var i = this._zlevelList, n = 0; n < i.length; n++) {
      var a = i[n];
      t.call(e, this._layers[a], a);
    }
  }, r.prototype.eachBuiltinLayer = function(t, e) {
    for (var i = this._zlevelList, n = 0; n < i.length; n++) {
      var a = i[n], o = this._layers[a];
      o.__builtin__ && t.call(e, o, a);
    }
  }, r.prototype.eachOtherLayer = function(t, e) {
    for (var i = this._zlevelList, n = 0; n < i.length; n++) {
      var a = i[n], o = this._layers[a];
      o.__builtin__ || t.call(e, o, a);
    }
  }, r.prototype.getLayers = function() {
    return this._layers;
  }, r.prototype._updateLayerStatus = function(t) {
    this.eachBuiltinLayer(function(h, c) {
      h.__dirty = h.__used = !1;
    });
    function e(h) {
      a && (a.__endIndex !== h && (a.__dirty = !0), a.__endIndex = h);
    }
    if (this._singleCanvas)
      for (var i = 1; i < t.length; i++) {
        var n = t[i];
        if (n.zlevel !== t[i - 1].zlevel || n.incremental) {
          this._needsManuallyCompositing = !0;
          break;
        }
      }
    var a = null, o = 0, s, l;
    for (l = 0; l < t.length; l++) {
      var n = t[l], u = n.zlevel, f = void 0;
      s !== u && (s = u, o = 0), n.incremental ? (f = this.getLayer(u + h2, this._needsManuallyCompositing), f.incremental = !0, o = 1) : f = this.getLayer(u + (o > 0 ? Mo : 0), this._needsManuallyCompositing), f.__builtin__ || _s("ZLevel " + u + " has been used by unkown layer " + f.id), f !== a && (f.__used = !0, f.__startIndex !== l && (f.__dirty = !0), f.__startIndex = l, f.incremental ? f.__drawIndex = -1 : f.__drawIndex = l, e(l), a = f), n.__dirty & te && !n.__inHover && (f.__dirty = !0, f.incremental && f.__drawIndex < 0 && (f.__drawIndex = l));
    }
    e(l), this.eachBuiltinLayer(function(h, c) {
      !h.__used && h.getElementCount() > 0 && (h.__dirty = !0, h.__startIndex = h.__endIndex = h.__drawIndex = 0), h.__dirty && h.__drawIndex < 0 && (h.__drawIndex = h.__startIndex);
    });
  }, r.prototype.clear = function() {
    return this.eachBuiltinLayer(this._clearLayer), this;
  }, r.prototype._clearLayer = function(t) {
    t.clear();
  }, r.prototype.setBackgroundColor = function(t) {
    this._backgroundColor = t, T(this._layers, function(e) {
      e.setUnpainted();
    });
  }, r.prototype.configLayer = function(t, e) {
    if (e) {
      var i = this._layerConfig;
      i[t] ? j(i[t], e, !0) : i[t] = e;
      for (var n = 0; n < this._zlevelList.length; n++) {
        var a = this._zlevelList[n];
        if (a === t || a === t + Mo) {
          var o = this._layers[a];
          j(o, i[t], !0);
        }
      }
    }
  }, r.prototype.delLayer = function(t) {
    var e = this._layers, i = this._zlevelList, n = e[t];
    n && (n.dom.parentNode.removeChild(n.dom), delete e[t], i.splice(nt(i, t), 1));
  }, r.prototype.resize = function(t, e) {
    if (this._domRoot.style) {
      var i = this._domRoot;
      i.style.display = "none";
      var n = this._opts, a = this.root;
      if (t != null && (n.width = t), e != null && (n.height = e), t = so(a, 0, n), e = so(a, 1, n), i.style.display = "", this._width !== t || e !== this._height) {
        i.style.width = t + "px", i.style.height = e + "px";
        for (var o in this._layers)
          this._layers.hasOwnProperty(o) && this._layers[o].resize(t, e);
        this.refresh(!0);
      }
      this._width = t, this._height = e;
    } else {
      if (t == null || e == null)
        return;
      this._width = t, this._height = e, this.getLayer(jr).resize(t, e);
    }
    return this;
  }, r.prototype.clearLayer = function(t) {
    var e = this._layers[t];
    e && e.clear();
  }, r.prototype.dispose = function() {
    this.root.innerHTML = "", this.root = this.storage = this._domRoot = this._layers = null;
  }, r.prototype.getRenderedCanvas = function(t) {
    if (t = t || {}, this._singleCanvas && !this._compositeManually)
      return this._layers[jr].dom;
    var e = new Lu("image", this, t.pixelRatio || this.dpr);
    e.initContext(), e.clear(!1, t.backgroundColor || this._backgroundColor);
    var i = e.ctx;
    if (t.pixelRatio <= this.dpr) {
      this.refresh();
      var n = e.dom.width, a = e.dom.height;
      this.eachLayer(function(h) {
        h.__builtin__ ? i.drawImage(h.dom, 0, 0, n, a) : h.renderToCanvas && (i.save(), h.renderToCanvas(i), i.restore());
      });
    } else
      for (var o = {
        inHover: !1,
        viewWidth: this._width,
        viewHeight: this._height
      }, s = this.storage.getDisplayList(!0), l = 0, u = s.length; l < u; l++) {
        var f = s[l];
        ai(i, f, o, l === u - 1);
      }
    return e.dom;
  }, r.prototype.getWidth = function() {
    return this._width;
  }, r.prototype.getHeight = function() {
    return this._height;
  }, r;
})();
function d2(r) {
  r.registerPainter("canvas", p2);
}
ye([
  TA,
  lA,
  sI,
  TI,
  qI,
  dL,
  SL,
  GL,
  RL,
  f2,
  d2
]);
function g2(r) {
  const t = getComputedStyle(r || document.documentElement), e = (t.getPropertyValue("--ink") || "#18181b").trim() || "#18181b", i = (t.getPropertyValue("--muted") || "#6b6b73").trim() || "#6b6b73", n = (t.getPropertyValue("--hairline") || "rgba(0,0,0,0.08)").trim() || "rgba(0,0,0,0.08)", a = (() => {
    const o = document.documentElement.dataset.theme;
    if (o === "dark") return !0;
    if (o === "light") return !1;
    const s = (t.getPropertyValue("--canvas") || "#fff").trim();
    return /#1|#0|rgb\(\s*2[0-4]/.test(s) || matchMedia("(prefers-color-scheme: dark)").matches;
  })();
  return {
    backgroundColor: "transparent",
    textStyle: { color: e, fontFamily: "inherit" },
    legend: { textStyle: { color: i } },
    tooltip: {
      backgroundColor: a ? "#27272a" : "#ffffff",
      borderColor: n,
      textStyle: { color: e, fontSize: 12 },
      confine: !0,
      transitionDuration: 0,
      enterable: !1,
      extraCssText: "pointer-events:none;"
    }
  };
}
const D_ = ["pointermove", "pointerdown", "mousemove", "mousedown"];
function y2(r) {
  if (fv(r), !r || typeof r.addEventListener != "function") return;
  const t = (e) => {
    const i = r.querySelector && r.querySelector("canvas");
    if (!i || e.clientX == null) return;
    const n = i.getBoundingClientRect();
    n.width > 0 && n.height > 0 && (e.zrX = (e.clientX - n.left) * (i.clientWidth / n.width), e.zrY = (e.clientY - n.top) * (i.clientHeight / n.height));
  };
  for (const e of D_) r.addEventListener(e, t, !0);
  r._citecatPtrFix = t;
}
function fv(r) {
  const t = r && r._citecatPtrFix;
  if (t) {
    for (const e of D_)
      try {
        r.removeEventListener(e, t, !0);
      } catch {
      }
    r._citecatPtrFix = null;
  }
}
function m2(r, t) {
  const e = r && r.tooltip || {}, i = e.trigger === "axis" ? { type: "line", snap: !0, animation: !1, ...e.axisPointer || {} } : e.axisPointer;
  return {
    ...t.tooltip || {},
    ...e,
    confine: !0,
    transitionDuration: 0,
    enterable: !1,
    extraCssText: [t.tooltip && t.tooltip.extraCssText, e.extraCssText, "pointer-events:none;"].filter(Boolean).join(""),
    ...i ? { axisPointer: i } : {}
  };
}
const ys = /* @__PURE__ */ new WeakMap();
function S2(r, t) {
  if (!r || !t) return null;
  fv(r);
  const e = Ea(r);
  e && e.dispose();
  const i = a0(r, null, { renderer: "canvas" }), n = g2(r);
  if (i.setOption({
    ...n,
    ...t,
    title: { show: !1 },
    tooltip: m2(t, n)
  }, { notMerge: !0 }), y2(r), typeof ResizeObserver < "u") {
    const a = ys.get(r) || r._citecatRo;
    if (a)
      try {
        a.disconnect();
      } catch {
      }
    const o = new ResizeObserver(() => {
      try {
        i.resize();
      } catch {
      }
    });
    o.observe(r), ys.set(r, o), r._citecatRo = o;
  }
  return r._citecatChart = i, i;
}
function b2(r) {
  if (!r) return;
  fv(r);
  const t = ys.get(r);
  if (t) {
    try {
      t.disconnect();
    } catch {
    }
    ys.delete(r);
  }
  if (r._citecatChart) {
    try {
      r._citecatChart.dispose();
    } catch {
    }
    r._citecatChart = null;
  } else {
    const e = Ea(r);
    if (e) try {
      e.dispose();
    } catch {
    }
  }
  r._citecatRo = null;
}
export {
  b2 as disposeEChart,
  _2 as echarts,
  S2 as renderEChart
};
