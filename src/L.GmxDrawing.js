(function () {

var _gtxt = function (key) {
    var res = L.gmxLocale ? L.gmxLocale.getText(key) : null;
    return res || key;
};
var downObject = null;
var rectDelta = 0.0000001;
var stateVersion = '1.0.0';

var defaultStyles = {
    mode: '',
    map: true,
    editable: true,
    holeStyle: {
        opacity: 0.5,
        color: '#003311'
    },
    lineStyle: {
        opacity:1,
        weight:2,
        noClip: true,
        clickable: false,
        className: 'leaflet-drawing-lines',
        color: '#0033ff',
        dashArray: null,
        lineCap: null,
        lineJoin: null,
        fill: false,
        fillColor: null,
        fillOpacity: 0.2,
        smoothFactor: 1,
        stroke: true
    },
    pointStyle: {
        className: 'leaflet-drawing-points',
        noClip: true,
        smoothFactor: 0,
        opacity: 1,
        shape: 'circle',
        fill: true,
        fillColor: '#ffffff',
        fillOpacity: 1,
        size: L.Browser.mobile ? 40 : 8,
        weight: 2,
        clickable: true,
        color: '#0033ff',
        dashArray: null,
        lineCap: null,
        lineJoin: null,
        stroke: true
    },
    markerStyle: {
        mode: '',
        editable: false,
        options: {
            alt: '',
            title: '',
            clickable: true,
            draggable: false,
            keyboard: true,
            opacity: 1,
            zIndexOffset: 0,
            riseOffset: 250,
            riseOnHover: false,
            icon: {
                className: '',
                iconUrl: '',
                iconAnchor: [12, 41],
                iconSize: [25, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            }
        }
    }
};
function getNotDefaults(from, def) {
    var res = {};
    for (var key in from) {
        if (key === 'icon' || key === 'map') {
            continue;
        } else if (key === 'iconAnchor' || key === 'iconSize' || key === 'popupAnchor' || key === 'shadowSize') {
            if (!def[key]) { continue; }
            if (def[key][0] !== from[key][0] || def[key][1] !== from[key][1]) { res[key] = from[key]; }
        } else if (key === 'lineStyle' || key === 'pointStyle') {
            res[key] = getNotDefaults(from[key], def[key]);
        } else if (!def || (def[key] !== from[key] || key === 'fill')) {
            res[key] = from[key];
        }
    }
    return res;
}

L.GmxDrawing = L.Class.extend({
    options: {
        type: ''
    },
    includes: L.Mixin.Events,

    initialize: function (map) {
        this._map = map;
        this.items = [];
        this.current = null;

        if (L.gmxUtil && L.gmxUtil.prettifyDistance) {
            var tooltip = document.createElementNS(L.Path.SVG_NS, 'g');
            L.DomUtil.addClass(tooltip, 'gmxTooltip');
            var bg = document.createElementNS(L.Path.SVG_NS, 'rect');
            bg.setAttributeNS(null, 'rx', 4);
            bg.setAttributeNS(null, 'ry', 4);
            bg.setAttributeNS(null, 'height', 16);
            L.DomUtil.addClass(bg, 'gmxTooltipBG');

            var text = document.createElementNS(L.Path.SVG_NS, 'text');
            var userSelectProperty = L.DomUtil.testProp(
                ['userSelect', 'WebkitUserSelect', 'OUserSelect', 'MozUserSelect', 'msUserSelect']);
            text.style[userSelectProperty] = 'none';
            tooltip.appendChild(bg);
            tooltip.appendChild(text);

            this.hideTooltip = function() {
                tooltip.setAttributeNS(null, 'visibility', 'hidden');
            };
            this.showTooltip = function(point, mouseovertext) {
                var x = point.x + 11,
                    y = point.y - 14;
                text.setAttributeNS(null, 'x', x);
                text.setAttributeNS(null, 'y', y);
                text.textContent = mouseovertext;
                if (tooltip.getAttributeNS(null, 'visibility') !== 'visible') {
                    this._map._pathRoot.appendChild(tooltip);
                    tooltip.setAttributeNS(null, 'visibility', 'visible');
                }
                var length = text.getComputedTextLength();
                bg.setAttributeNS(null, 'width', length + 8);
                bg.setAttributeNS(null, 'x', x - 4);
                bg.setAttributeNS(null, 'y', y - 12);
            };
        }
    },

    bringToFront: function () {
        for (var i = 0, len = this.items.length; i < len; i++) {
            var item = this.items[i];
            if (item._map && 'bringToFront' in item) { item.bringToFront(); }
        }
    },

    addGeoJSON: function (obj, options) {
        var arr = [],
            isLGeoJSON = obj instanceof L.GeoJSON;
        if (!isLGeoJSON) {
            obj = L.geoJson(obj, options);
        }
        if (obj instanceof L.GeoJSON) {
            var layers = obj.getLayers();
            if (layers) {
                for (var i = 0, len = layers.length; i < len; i++) {
                    arr.push(this.add(layers[i], options));
                }
            }
        }
        return arr;
    },

    add: function (obj, options) {
        var item = null;
        if (obj instanceof L.GmxDrawing.Feature) {
            item = obj;
        } else {
            options = options || {};
            if (!('editable' in options)) { options.editable = true; }
            if (obj instanceof L.Rectangle)     { options.type = 'Rectangle'; }
            else if (obj instanceof L.Polygon)  { options.type = 'Polygon'; }
            else if (obj instanceof L.MultiPolygon)  { options.type = 'MultiPolygon'; options.editable = true; }
            else if (obj instanceof L.Polyline) { options.type = 'Polyline'; }
            else if (obj instanceof L.MultiPolyline) { options.type = 'MultiPolyline'; options.editable = true; }
            else if (obj instanceof L.Marker) {
                options.type = 'Point'; options.editable = false;
            }
            item = new L.GmxDrawing.Feature(this, obj, options);
        }
        if (!('map' in options)) { options.map = true; }
        if (options.map && !item._map) { this._map.addLayer(item); }
        else { this._addItem(item); }
        //if (!item._map) this._map.addLayer(item);
        //if (item.points) item.points._path.setAttribute('fill-rule', 'inherit');
        if ('setEditMode' in item) { item.setEditMode(); }
        return item;
    },

    _disableDrag: function () {
        this._map.dragging.disable();
        L.DomUtil.disableTextSelection();
        L.DomUtil.disableImageDrag();
		this._map.doubleClickZoom.removeHooks();
    },

    _enableDrag: function () {
        this._map.dragging.enable();
        L.DomUtil.enableTextSelection();
        L.DomUtil.enableImageDrag();
		this._map.doubleClickZoom.addHooks();
    },

    _clearCreate: function () {
        if (this._createKey) {
            if (this._createKey.type === 'Rectangle' && L.Browser.mobile) {
                L.DomEvent.off(this._map._container, 'touchstart', this._createKey.fn, this);
            } else {
                this._map.off(this._createKey.eventName, this._createKey.fn, this);
            }
            this._enableDrag();
        }
        this._createKey = null;
    },

    create: function (type, drawOptions) {
        this._clearCreate(null);
        if (type) {
            if (type === 'Rectangle') {
                this._map._initPathRoot();
                this._map.dragging.disable();
            }
            var my = this,
                iconStyle;
            drawOptions = drawOptions || {};
            if (drawOptions.iconUrl) {
                iconStyle = {
                    iconUrl: drawOptions.iconUrl
                };
                delete drawOptions.iconUrl;
                if (drawOptions.iconAnchor) {
                    iconStyle.iconAnchor = drawOptions.iconAnchor;
                    delete drawOptions.iconAnchor;
                }
                if (drawOptions.iconSize) {
                    iconStyle.iconSize = drawOptions.iconSize;
                    delete drawOptions.iconSize;
                }
                if (drawOptions.popupAnchor) {
                    iconStyle.popupAnchor = drawOptions.popupAnchor;
                    delete drawOptions.popupAnchor;
                }
                if (drawOptions.shadowSize) {
                    iconStyle.shadowSize = drawOptions.shadowSize;
                    delete drawOptions.shadowSize;
                }
                drawOptions.markerStyle = {
                    iconStyle: iconStyle
                };
            }
            this._createKey = {
                type: type,
                eventName: type === 'Rectangle' ? (L.Browser.mobile ? 'touchstart' : 'mousedown') : 'click',
                fn: function (ev) {
                    var obj, key,
                        opt = {},
                        latlng = ev.latlng;

                    for (key in drawOptions) {
                        if (!(key in defaultStyles)) {
                            opt[key] = drawOptions[key];
                        }
                    }
                    if (type === 'Point') {
                        var markerStyle = drawOptions.markerStyle || {},
                            markerOpt = {
                                draggable: true
                            };
                        if (ev && ev.originalEvent) {
                            markerOpt.ctrlKey = ev.originalEvent.ctrlKey;
                            markerOpt.shiftKey = ev.originalEvent.shiftKey;
                            markerOpt.altKey = ev.originalEvent.altKey;
                        }
                        if (markerStyle.iconStyle) {
                            markerOpt.icon = L.icon(markerStyle.iconStyle);
                        }
                        obj = my.add(L.marker(latlng, markerOpt), opt);
                    } else {
                        if (drawOptions.pointStyle) { opt.pointStyle = drawOptions.pointStyle; }
                        if (drawOptions.lineStyle) { opt.lineStyle = drawOptions.lineStyle; }
                        if (type === 'Rectangle') {
                            if (L.Browser.mobile) {
                                var downAttr = L.GmxDrawing.utils.getDownType.call(my, ev, my._map);
                                latlng = downAttr.latlng;
                            }
                            opt.mode = 'edit';
                            obj = my.add(
                                L.rectangle(L.latLngBounds(L.latLng(latlng.lat + rectDelta, latlng.lng - rectDelta), latlng))
                            , opt);
                            if (L.Browser.mobile) { obj._startTouchMove(ev, true); }
                            else { obj._pointDown(ev); }

                            obj.rings[0].ring._drawstop = true;
                        } else if (type === 'Polygon') {
                            opt.mode = 'add';
                            obj = my.add(L.polygon([latlng]), opt);
                            obj.setAddMode();
                        } else if (type === 'Polyline') {
                            opt.mode = 'add';
                            obj = my.add(L.polyline([latlng]), opt).setAddMode();
                        }
                    }
                    my._clearCreate();
                }
            };
            if (type === 'Rectangle' && L.Browser.mobile) {
                L.DomEvent.on(my._map._container, 'touchstart', this._createKey.fn, this);
            } else {
                this._map.on(this._createKey.eventName, this._createKey.fn, this);
            }
            L.DomUtil.addClass(my._map._mapPane, 'leaflet-clickable');
            this.fire('drawstart', {mode: type});
        }
        this.options.type = type;
    },

    getFeatures: function () {
        var out = [];
        for (var i = 0, len = this.items.length; i < len; i++) {
            out.push(this.items[i]);
        }
        return out;
    },

    loadState: function (data) {
        //if (data.version !== stateVersion) return;

        var _this = this,
            featureCollection = data.featureCollection;
        L.geoJson(featureCollection, {
            onEachFeature: function (feature, layer) {
                var options = feature.properties;
                if (options.type === 'Rectangle') {
                    layer = L.rectangle(layer.getBounds());
                } else if (options.type === 'Point') {
                    options = options.options;
                    var icon = options.icon;
                    if (icon) {
                        delete options.icon;
                        if (icon.iconUrl) { options.icon = L.icon(icon); }
                    }
                    layer = L.marker(layer.getLatLng(), options);
                }
                _this.add(layer, options);
            }
        });
    },

    saveState: function () {
        var featureGroup = L.featureGroup();
        var points = [];
        for (var i = 0, len = this.items.length; i < len; i++) {
            var it = this.items[i];
            if (it.options.type === 'Point') {
                var geojson = it.toGeoJSON();
                geojson.properties = getNotDefaults(it.options, defaultStyles.markerStyle);
                if (!it._map) { geojson.properties.map = false; }
                var res = getNotDefaults(it._obj.options, defaultStyles.markerStyle.options);
                if (Object.keys(res).length) { geojson.properties.options = res; }
                res = getNotDefaults(it._obj.options.icon.options, defaultStyles.markerStyle.options.icon);
                if (Object.keys(res).length) {
                    if (!geojson.properties.options) { geojson.properties.options = {}; }
                    geojson.properties.options.icon = res;
                }
                points.push(geojson);
            } else {
                featureGroup.addLayer(it);
            }
        }
        var featureCollection = featureGroup.toGeoJSON();
        featureCollection.features = featureCollection.features.concat(points);
        return {
            version: stateVersion,
            featureCollection: featureCollection
        };
    },

    _addItem: function (item) {
        var addFlag = true;
        for (var i = 0, len = this.items.length; i < len; i++) {
            var it = this.items[i];
            if (it === item) {
                addFlag = false;
                break;
            }
        }
        if (addFlag) { this.items.push(item); }
        this.fire('add', {mode: item.mode, object: item});
    },

    _removeItem: function (obj, remove) {
        for (var i = 0, len = this.items.length; i < len; i++) {
            var item = this.items[i];
            if (item === obj) {
                if (remove) {
                    this.items.splice(i, 1);
                    var ev = {type: item.options.type, mode: item.mode, object: item};
                    this.fire('remove', ev);
                    item.fire('remove', ev);
                }
                return item;
            }
        }
        return null;
    },

    clear: function () {
        for (var i = 0, len = this.items.length; i < len; i++) {
            var item = this.items[i];
            if (item && item._map) {
                item._map.removeLayer(item);
            }
            var ev = {type: item.options.type, mode: item.mode, object: item};
            this.fire('remove', ev);
            item.fire('remove', ev);
        }
        this.items = [];
        return this;
    },

    remove: function (obj) {
        var item = this._removeItem(obj, true);
        if (item && item._map) {
            item._map.removeLayer(item);
        }
        return item;
    }
});

L.Map.addInitHook(function () {
    this.gmxDrawing = new L.GmxDrawing(this);
});

L.GmxDrawing.Feature = L.LayerGroup.extend({
    options: {
        mode: '' // add, edit
    },
    includes: L.Mixin.Events,

    bringToFront: function () {
        return this.invoke('bringToFront');
    },

    bringToBack: function () {
        return this.invoke('bringToBack');
    },

    onAdd: function (map) {
        L.LayerGroup.prototype.onAdd.call(this, map);
        this._parent._addItem(this);
        if (this.options.type === 'Point') {
            map.addLayer(this._obj);
            var _this = this;
            setTimeout(function () {
                _this._fireEvent('drawstop', _this._obj.options);
            }, 0);
        }
        this._fireEvent('addtomap');
        //this.setEditMode();
    },

    onRemove: function (map) {
        if (this.points) {
            this._pointUp();
            this.removeAddMode();
            this.removeEditMode();

            if ('hideTooltip' in this) { this.hideTooltip(); }
        }
        L.LayerGroup.prototype.onRemove.call(this, map);
        if (this.options.type === 'Point') {
            map.removeLayer(this._obj);
        }
        this._fireEvent('removefrommap');
    },

    remove: function (ring) {
        var i, j, len, len1, hole;
        for (i = 0, len = this.rings.length; i < len; i++) {
            if (ring.options.hole) {
                for (j = 0, len1 = this.rings[i].holes.length; j < len1; j++) {
                    hole = this.rings[i].holes[j];
                    if (ring === hole) {
                        this.rings[i].holes.splice(j, 1);
                        if (hole._map) {
                            hole._map.removeLayer(hole);
                        }
                        break;
                    }
                }
                if (!ring._map) {
                    break;
                }
            } else if (ring === this.rings[i].ring) {
                for (j = 0, len1 = this.rings[i].holes.length; j < len1; j++) {
                    hole = this.rings[i].holes[j];
                    if (hole._map) {
                        hole._map.removeLayer(hole);
                    }
                }
                this.rings.splice(i, 1);
                if (ring._map) {
                    ring._map.removeLayer(ring);
                }
                break;
            }
        }
        if (this.rings.length < 1) {
            this._parent.remove(this);
        }
        return this;
    },

    _fireEvent: function (name) {
console.log('_fireEvent', name);
        if (name === 'removefrommap' && this.rings.length > 1) {
            return;
        }
        var event = {mode: this.mode || '', object: this};
        this.fire(name, event);
        this._parent.fire(name, event);
        if (name === 'drawstop') {
            L.DomUtil.removeClass(this._map._mapPane, 'leaflet-clickable');
        }
    },

    setOptions: function (options) {
        L.setOptions(this, options);
        if (options.lineStyle) {
            this._setStyleOptions(options.lineStyle, 'lines');
        }
        if (options.pointStyle) {
            this._setStyleOptions(options.pointStyle, 'points');
        }
        if ('editable' in options) {
            if (options.editable) { this.enableEdit(); }
            else { this.disableEdit(); }
        }

        this._fireEvent('optionschange');
    },

    _setStyleOptions: function (options, type) {
        for (var i = 0, len = this.rings.length; i < len; i++) {
            var it = this.rings[i].ring[type];
            it.setStyle(options);
            it.redraw();
            for (var j = 0, len1 = this.rings[i].holes.length; j < len1; j++) {
                it = this.rings[i].holes[j][type];
                it.setStyle(options);
                it.redraw();
            }
        }
        this._fireEvent('stylechange');
    },

    _setLinesStyle: function (options) {
        this._setStyleOptions(options, 'lines');
    },

    _setPointsStyle: function (options) {
        this._setStyleOptions(options, 'points');
    },

    getOptions: function () {
        var data = L.extend({}, this.options);
        data.lineStyle = this.options.lineStyle;
        data.pointStyle = this.options.pointStyle;

        var res = getNotDefaults(data, defaultStyles);
        if (!Object.keys(res.lineStyle).length) { delete res.lineStyle; }
        if (!Object.keys(res.pointStyle).length) { delete res.pointStyle; }
        if (!this._map) { res.map = false; }
        return res;
    },

    toGeoJSON: function () {
        var type = this.options.type,
            coords;
        if (this.rings) {
            coords = [];
            for (var i = 0, arr = [], len = this.rings.length; i < len; i++) {
                var it = this.rings[i];
                arr.push(L.GeoJSON.latLngsToCoords(it.ring.points.getLatLngs()));
                if (it.holes && it.holes.length) {
                    for (var j = 0, len1 = it.holes.length; j < len1; j++) {
                        arr.push(L.GeoJSON.latLngsToCoords(it.holes[j].points.getLatLngs()));
                    }
                }
                coords.push(arr);
            }
            if (type === 'Polyline') { coords = coords[0]; }
            //coords = L.GeoJSON.latLngsToCoords(this.points.getLatLngs());
            //if (type === 'Polygon' || type === 'Rectangle') { coords = [coords]; }
        } else {
            var geojson = this._obj.toGeoJSON();
            coords = geojson.geometry.coordinates;
        }

        if (type === 'Rectangle') { type = 'Polygon'; }
        else if (type === 'Polyline') { type = 'LineString'; }
        else if (type === 'MultiPolyline') { type = 'MultiLineString'; }

        var properties = this.getOptions();
        delete properties.mode;

        return L.GeoJSON.getFeature({
            feature: {
                type: 'Feature',
                properties: properties
            }
        }, {
            type: type,
            coordinates: coords
        });
    },

    getType: function () {
        return this.options.type;
    },
/*
    getBounds: function() {
        var out = null;
        if (this.options.type === 'Point') {
            var lantlg = this.getLatLng();
            out = L.latLngBounds([lantlg.lat, lantlg.lng], [lantlg.lat, lantlg.lng]);
        } else {
            out = (this.lines || this._obj).getBounds();
        }
        return out;
    },
*/
    initialize: function (parent, obj, options) {
        options = options || {};
        options.mode = '';
        L.setOptions(this, options);

        this._layers = {};
        this._obj = obj;
        this._parent = parent;

        this._initialize(parent, obj);
    },

    enableEdit: function() {
        this.options.mode = 'edit';
        var type = this.options.type;
        if (type !== 'Point' && type.indexOf('Multi') === -1) {
            this.options.editable = true;
            this._initialize(this._parent, this._obj);
        }
        this.setEditMode();
        return this;
    },

    disableEdit: function() {
        var type = this.options.type;
        if (type !== 'Point' && type.indexOf('Multi') === -1) {
            this.removeEditMode();
            this.options.editable = false;
            this._obj.setLatLngs(this.getLatLngs());
            this._initialize(this._parent, this._obj);
        }
        return this;
    },

    getArea: function () {
        var out = 0;
        if (L.gmxUtil.getArea) {
            for (var i = 0, len = this.rings.length; i < len; i++) {
                var it = this.rings[i];
                out += L.gmxUtil.getArea(it.ring.points._latlngs);
                for (var j = 0, len1 = it.holes.length; j < len1; j++) {
                    out -= L.gmxUtil.getArea(it.holes[j].points._latlngs);
                }
            }
        }
        return out;
    },

    getLength: function () {
        var out = 0;
        if (L.gmxUtil.getLength) {
            for (var i = 0, len = this.rings.length; i < len; i++) {
                var it = this.rings[i];
                out += L.gmxUtil.getLength(it.ring.points._latlngs);
                for (var j = 0, len1 = it.holes.length; j < len1; j++) {
                    out += L.gmxUtil.getLength(it.holes[j].points._latlngs);
                }
            }
        }
        return out;
    },

    _initialize: function (parent, obj) {
        this.clearLayers();
        this.rings = [];

        this.mode = '';

        if (this.options.editable) {
            var layers = obj instanceof L.LayerGroup ? obj._layers : [obj];
            for (var key in layers) {
                var it = layers[key],
                    holes = [],
                    ring = new L.GmxDrawing.Ring(this, it._latlngs, {ring: true});

                this.addLayer(ring);
                if (it._holes) {
                    for (var j = 0, len1 = it._holes.length; j < len1; j++) {
                        var hole = new L.GmxDrawing.Ring(this, it._holes[j], {hole: true});
                        this.addLayer(hole);
                        holes.push(hole);
                    }
                }
                this.rings.push({ring: ring, holes: holes});
            }

            if (L.gmxUtil && L.gmxUtil.prettifyDistance) {
                var my = this;
                this._showTooltip = function (type, ev) {
                    if (!downObject || downObject === this) {
                        var mapOpt = my._map.options || {},
                            distanceUnit = mapOpt.distanceUnit || 'km',
                            squareUnit = mapOpt.squareUnit || 'ha',
                            str = '',
                            arr = [];

                        if (type === 'Area') {
                            if (!L.gmxUtil.getArea) { return; }
                            if (ev.originalEvent.ctrlKey) {
                                str = _gtxt('Perimeter') + ': ' + L.gmxUtil.prettifyDistance(my.getLength(), distanceUnit);
                            } else {
                                str = _gtxt(type) + ': ' + L.gmxUtil.prettifyArea(my.getArea(), squareUnit);
                            }
                            my._parent.showTooltip(ev.layerPoint, str);
                        } else if (type === 'Length') {
                            var downAttr = L.GmxDrawing.utils.getDownType.call(my, ev, my._map);
//console.log('downAttr', downAttr);
                            var _latlngs = ev.ring.points._latlngs;
                            if (downAttr.type === 'node') {
                                arr = _latlngs.slice(0, downAttr.num + 1);
                            } else {
                                arr = _latlngs.slice(downAttr.num - 1, downAttr.num + 1);
                                if (arr.length === 1) { arr.push(_latlngs[0]); }
                            }
                            var length = L.gmxUtil.getLength(arr);
                            str = _gtxt(type) + ': ' + L.gmxUtil.prettifyDistance(length, distanceUnit);
                            my._parent.showTooltip(ev.layerPoint, str);
                        }
                        my._fireEvent('onMouseOver');
                    }
                };
                this.hideTooltip = function() {
                    if (!downObject || downObject === this) {
                        this._parent.hideTooltip();
                        this._fireEvent('onMouseOut');
                    }
                };
            }
        } else {
            if (this.options.type === 'Point') {
                this._setMarker(obj);
            } else {
                this.addLayer(obj);
            }
        }
    },

    _enableDrag: function () {
        this._parent._enableDrag();
    },

    _disableDrag: function () {
        this._parent._disableDrag();
    },

    _setMarker: function (marker) {
        var _this = this,
            _parent = this._parent;
        marker
            .bindPopup(null, {maxWidth: 1000})
            .on('dblclick', function() {
                this._map.removeLayer(this);
                _this.remove();
                //_parent.remove(this);
            })
            .on('dragstart', function() {
                _this._fireEvent('dragstart');
            })
            .on('drag', function() {
                _this._fireEvent('drag');
                _this._fireEvent('edit');
            })
            .on('dragend', function() {
                _this._fireEvent('dragend');
            })
            .on('popupopen', function(ev) {
                var popup = ev.popup;
                if (!popup._input) {
                    popup._input = L.DomUtil.create('textarea', 'leaflet-gmx-popup-textarea', popup._contentNode);
                    popup._input.placeholder = marker.options.title || '';
                    popup._contentNode.style.width = 'auto';
                }
                L.DomEvent.on(popup._input, 'keyup', function() {
                    var rows = this.value.split('\n'),
                        cols = this.cols || 0;

                    rows.forEach(function(str) {
                        if (str.length > cols) { cols = str.length; }
                    });
                    this.rows = rows.length;
                    if (cols) { this.cols = cols; }
                    popup.update();
                    marker.options.title = this.value;
                }, popup._input);
                popup.update();
            });
        _parent._map.addLayer(marker);
    },

    setAddMode: function () {
        if (this.rings.length) {
            this.rings[0].ring.setAddMode();
        }
		return this;
    },

    _pointDown: function (ev) {
        if (this.rings.length) {
            this.rings[0].ring._pointDown(ev);
        }
    }
});

L.GmxDrawing.Ring = L.LayerGroup.extend({
    options: {
        className: 'leaflet-drawing-ring',
        noClip: true,
		smoothFactor: 0,
        opacity: 1,
        shape: 'circle',
        fill: true,
        fillColor: '#ffffff',
        fillOpacity: 1,
        size: L.Browser.mobile ? 40 : 8,
        weight: 2
    },
    includes: L.Mixin.Events,
    initialize: function (parent, coords, options) {
        options = options || {};
        options.mode = '';
        this.options = L.extend({}, parent.options, options);

        this._layers = {};
        this._coords = coords;
        this._parent = parent;

        this._initialize(parent, coords);
    },
    _initialize: function (parent, coords) {
        this.clearLayers();
        delete this.lines;
        delete this.fill;
        delete this.points;

        this.mode = '';
        this.lineType = this.options.type.indexOf('Polyline') !== -1;

        var pointStyle = this.options.pointStyle;
        var lineStyle = {opacity:1, weight:2, noClip: true, clickable: false, className: 'leaflet-drawing-lines'};
        if (!this.lineType) {
            lineStyle.fill = 'fill' in this.options ? this.options.fill : true;
        }
        if (this.options.lineStyle) {
            for (var key in this.options.lineStyle) {
                if (key !== 'fill' || !this.lineType) {
                    lineStyle[key] = this.options.lineStyle[key];
                }
            }
        }
        if (this.options.hole) {
            lineStyle = L.extend({}, lineStyle, defaultStyles.holeStyle);
            pointStyle = L.extend({}, pointStyle, defaultStyles.holeStyle);
        }

        var latlngs = coords,
            _this = this,
            mode = this.options.mode || (latlngs.length ? 'edit' : 'add');

        this.lines = new L.Polyline(latlngs, lineStyle);
        this.addLayer(this.lines);
        this.fill = new L.GmxDrawing._Fill(latlngs);
        this.addLayer(this.fill);
        if (!this.lineType && mode === 'edit') {
            this.lines.addLatLng(latlngs[0]);
            this.fill.addLatLng(latlngs[0]);
        }
        this.mode = mode;

        this.points = new L.GmxDrawing.PointMarkers(latlngs, pointStyle);
        this.points._parent = this;
        this.addLayer(this.points);
        this.points
            .on('mouseover mousemove', function (ev) {
                ev.ring = _this;
                parent._showTooltip(_this.lineType ? 'Length' : 'Area', ev);
            }, parent)
            .on('mouseout', function (ev) {
                parent.hideTooltip();
            }, parent);
        this.fill
            .on('mouseover mousemove', function (ev) {
                ev.ring = _this;
                parent._showTooltip('Length', ev);
            }, parent)
            .on('mouseout', function (ev) {
                parent.hideTooltip();
            }, parent);
        
    },

    onAdd: function (map) {
        L.LayerGroup.prototype.onAdd.call(this, map);
        this.setEditMode();
    },

    onRemove: function (map) {
        if (this.points) {
            this._pointUp();
            this.removeAddMode();
            this.removeEditMode();

            if ('hideTooltip' in this._parent) { this._parent.hideTooltip(); }
        }
        L.LayerGroup.prototype.onRemove.call(this, map);
        if (this.options.type === 'Point') {
            map.removeLayer(this._obj);
        }
        this._fireEvent('removefrommap');
    },

    _setPoint: function (latlng, nm, type) {
        if (!this.points) { return; }
        var points = this.points._latlngs;
        if (this.options.type === 'Rectangle') {
            if (type === 'edge') {
                nm--;
                if (nm === 0) { points[0].lng = points[1].lng = latlng.lng; }
                else if (nm === 1) { points[1].lat = points[2].lat = latlng.lat; }
                else if (nm === 2) { points[2].lng = points[3].lng = latlng.lng; }
                else if (nm === 3) { points[0].lat = points[3].lat = latlng.lat; }
            } else {
                points[nm] = latlng;
                if (nm === 0) { points[3].lat = latlng.lat; points[1].lng = latlng.lng; }
                else if (nm === 1) { points[2].lat = latlng.lat; points[0].lng = latlng.lng; }
                else if (nm === 2) { points[1].lat = latlng.lat; points[3].lng = latlng.lng; }
                else if (nm === 3) { points[0].lat = latlng.lat; points[2].lng = latlng.lng; }
            }
        } else {
            points[nm] = latlng;
        }
        this.setLatLngs(points);
    },

    addLatLng: function (point) {
        if (this.points) {
            this._setPoint(point, this.points._latlngs.length, 'node');
        } else if ('addLatLng' in this._obj) {
            this._obj.addLatLng(point);
        }
    },

    setLatLngs: function (points) {
        //console.log('setLatLngs', points);
        if (this.points) {
            this.fill.setLatLngs(points);
            this.lines.setLatLngs(points);
            if (!this.lineType && this.mode === 'edit' && points.length > 2) {
                this.lines.addLatLng(points[0]);
                this.fill.addLatLng(points[0]);
            }
            this.points.setLatLngs(points);
        } else if ('setLatLngs' in this._obj) {
            this._obj.setLatLngs(points);
        }
        this._fireEvent('edit');
    },
    // edit mode
    _pointDown: function (ev) {
        if (ev.originalEvent && ev.originalEvent.ctrlKey) {
            this._onDragStart(ev);
            return;
        }

        //ev.ring = this;
        var downAttr = L.GmxDrawing.utils.getDownType.call(this, ev, this._map),
            num = downAttr.num,
            type = downAttr.type,
            points = this.points._latlngs,
            opt = this.options,
            latlng = ev.latlng;

        this.down = downAttr;
        if (type === 'edge' && opt.type !== 'Rectangle') {
            if (opt.disableAddPoints) { return; }
            points.splice(num, 0, points[num]);
            this._setPoint(latlng, num, type);
        }
        downObject = this._parent;
        this._map
            .on('mousemove', this._pointMove, this)
            .on('mouseup', this._pointUp, this);

        this._parent._enableDrag();
    },

    _pointMove: function (ev) {
        if (this.down) {
            if (!this.lineType) { this.lines.setStyle({fill: true}); }
            this._setPoint(ev.latlng, this.down.num, this.down.type);
            this.skipClick = true;
            if ('_showTooltip' in this) {
                this._showTooltip(this.lineType ? 'Length' : 'Area', ev);
            }
        }
    },

    _pointUp: function () {
        if (!this.points) { return; }
        downObject = null;
        if (this._map) {
            this._map
                .off('mousemove', this._pointMove, this)
                .off('mouseup', this._pointUp, this);
        }
console.log('_pointUp', this.mode, this._drawstop);
        if (this._drawstop) {
            this._fireEvent('drawstop');
            this.skipClick = false;
        }
        this._drawstop = false;
        this.down = null;
        var lineStyle = this.options.lineStyle || {};
        if (!lineStyle.fill && !this.lineType) {
            this.lines.setStyle({fill: false});
        }
    },
    _lastPointClickTime: 0,  // Hack for emulate dblclick on Point

    _removePoint: function (num) {
        var points = this.points._latlngs;
        if (points.length > num) {
            points.splice(num, 1);
            if (this.options.type === 'Rectangle'
                || points.length < 2
                || (points.length < 3 && !this.lineType)
                //|| (points.length < 3 && this.options.type === 'Polygon')
                ) {
                this._parent.remove(this);
                //this.remove();
            } else {
                this._setPoint(points[0], 0);
            }
        }
    },

    _pointClick: function (ev) {
        if (ev.originalEvent && ev.originalEvent.ctrlKey) { return; }
        var downAttr = L.GmxDrawing.utils.getDownType.call(this, ev, this._map);
        var clickTime = new Date().getTime(),
            prevClickTime = this._lastPointClickTime;
        this._lastPointClickTime = clickTime + 300;
        if (downAttr.type === 'node' && !this.skipClick) {
            var num = downAttr.num;
            if (clickTime < prevClickTime) {  // this is dblclick on Point
                if (this.addLinePointTimer) {
                    clearTimeout(this.addLinePointTimer);
                    this.addLinePointTimer = null;
                }
                this._removePoint(num);
                this.setEditMode();
            } else if (this.lineType && downAttr.end) {
                if (!this.addLinePointTimer) {
                    var my = this,
                        latlng = downAttr.latlng;
                    this.addLinePointTimer = setTimeout(function () {
                        clearTimeout(my.addLinePointTimer);
                        my.addLinePointTimer = null;
                        my._pointUp();
                        if (num === 0) { my.points._latlngs.reverse(); }
                        if (!L.Browser.mobile) { my.points.addLatLng(latlng); }
                        my.setAddMode();
                        my._fireEvent('drawstop');
                    }, 300);
                }
            }
        }
        this.skipClick = false;
    },

    _onDragEnd: function () {
        this._map
            .off('mouseup', this._onDragEnd, this)
            .off('mousemove', this._onDrag, this);
        this._fireEvent('dragend');
    },

    _onDragStart: function (ev) {
        this._dragstartPoint = ev.latlng;
        this._map
            .on('mouseup', this._onDragEnd, this)
            .on('mousemove', this._onDrag, this);
        this._fireEvent('dragstart');
    },

    _onDrag: function (ev) {
        var lat = this._dragstartPoint.lat - ev.latlng.lat,
            lng = this._dragstartPoint.lng - ev.latlng.lng,
            points = this.points._latlngs;

        points.forEach(function (item) {
            item.lat -= lat;
            item.lng -= lng;
        });
        this._dragstartPoint = ev.latlng;

        this.setLatLngs(points);
        this._fireEvent('drag');
    },

    _fireEvent: function (name) {
        this._parent._fireEvent(name);
    },

    _startTouchMove: function (ev, drawstop) {
        var downAttr = L.GmxDrawing.utils.getDownType.call(this, ev, this._map);
        if (downAttr.type === 'node') {
            this._parent._disableDrag();
            this.down = downAttr;
            //var num = downAttr.num;
            var my = this;
            var _touchmove = function (ev) {
                downAttr = L.GmxDrawing.utils.getDownType.call(my, ev, my._map);
                    if (ev.touches.length === 1) { // Only deal with one finger
                        my._pointMove(downAttr);
                  }
            };
            var _touchend = function () {
                L.DomEvent
                    .off(my._map._container, 'touchmove', _touchmove, my)
                    .off(my._map._container, 'touchend', _touchend, my);
                my._parent._enableDrag();
                my.skipClick = false;
				if (drawstop) {
                    my._parent.fire('drawstop', {mode: my.options.type, object: my});
                }
            };
            L.DomEvent
                .on(my._map._container, 'touchmove', _touchmove, my)
                .on(my._map._container, 'touchend', _touchend, my);
        }
    },

    _editHandlers: function (flag) {
        if (!this.points) { return; }
        var stop = L.DomEvent.stopPropagation;
        //var prevent = L.DomEvent.preventDefault;
		if (this.touchstart) {
            L.DomEvent.off(this.points._container, 'touchstart', this.touchstart, this);
		}
        if (this.touchstartFill) {
            L.DomEvent.off(this.fill._container, 'touchstart', this.touchstartFill, this);
		}
        this.touchstart = null;
		this.touchstartFill = null;
        if (flag) {
			this.points
				.on('dblclick click', stop, this)
                .on('click', this._pointClick, this);
			if (L.Browser.mobile) {
				if (this._EditOpacity) {
					this._setPointsStyle({fillOpacity: this._EditOpacity});
				}
				var my = this;
				this.touchstart = function (ev) {
                    my._startTouchMove(ev);
				};
				L.DomEvent.on(this.points._container, 'touchstart', this.touchstart, this);
				this.touchstartFill = function (ev) {
					var downAttr = L.GmxDrawing.utils.getDownType.call(my, ev, my._map);
					if (downAttr.type === 'edge' && my.options.type !== 'Rectangle') {
					    var points = my.points._latlngs;
						points.splice(downAttr.num, 0, points[downAttr.num]);
						my._setPoint(downAttr.latlng, downAttr.num, downAttr.type);
					}
				};
				L.DomEvent.on(this.fill._container, 'touchstart', this.touchstartFill, this);
			} else {
				this.points
					.on('mousemove', stop)
					.on('mousedown', this._pointDown, this);
				this.fill
					.on('dblclick click', stop, this)
					.on('mousedown', this._pointDown, this);
				this._fireEvent('editmode');
			}
        } else {
            this._pointUp();
			this.points
				.off('dblclick click', stop, this)
				.off('click', this._pointClick, this);
			if (!L.Browser.mobile) {
				this.points
					.off('mousemove', stop)
					.off('mousedown', this._pointDown, this);
				this.fill
					.off('dblclick click', stop, this)
					.off('mousedown', this._pointDown, this);
			}
        }
    },

    _createHandlers: function (flag) {
        if (!this.points) { return; }
        var stop = L.DomEvent.stopPropagation,
            lineStyle = this.options.lineStyle || {};
        if (flag) {
            this._parent._enableDrag();
			if (L.Browser.mobile) {
				this._EditOpacity = this.points.options.fillOpacity;
				this._setPointsStyle({fillOpacity: 0.5});
				this.points.redraw();
				this._map
					.on('dblclick', stop)
					.on('click', this._mouseClick, this)
					.on('mousemove', this._moseMove, this);
				this.points
					.on('dblclick click', stop, this)
					//.on('mouseup', this._mouseup, this)
					.on('click', this._mouseClick, this);
			} else {
				this._map
					.on('dblclick', stop)
					.on('mousedown', this._mousedown, this)
					.on('mouseup', this._mouseup, this)
					.on('mousemove', this._moseMove, this);
				this.points
					.on('mouseup', this._mouseup, this);
            }
			this._fireEvent('addmode');
            if (!this.lineType) { this.lines.setStyle({fill: true}); }
        } else {
			if (L.Browser.mobile) {
				if (this._map) {
                    this._map
                        .off('dblclick', stop)
                        .off('click', this._mouseClick, this)
                        .off('mousemove', this._moseMove, this);
                    this.points
                        .off('dblclick click', stop, this)
                        .off('click', this._mouseClick, this);
                }
			} else if (this._map) {
                this._map
                    .off('dblclick', stop)
                    .off('mousedown', this._mousedown, this)
                    .off('mouseup', this._mouseup, this)
                    .off('mousemove', this._moseMove, this);
			}
            if (!lineStyle.fill && !this.lineType) {
                this.lines.setStyle({fill: false});
            }
        }
    },

    setEditMode: function () {
        if (this.options.editable) {
            this._editHandlers(false);
            this._createHandlers(false);
            this._editHandlers(true);
            this.mode = 'edit';
        }
		return this;
    },

    setAddMode: function () {
        if (this.options.editable) {
            this._editHandlers(false);
            this._createHandlers(false);
            this._createHandlers(true);
            this.mode = 'add';
        }
		return this;
    },

    removeAddMode: function () {
        this._createHandlers(false);
        this.mode = '';
    },

    removeEditMode: function () {
        this._editHandlers(false);
        this.mode = '';
    },

    // add mode
    _moseMove: function (ev) {
        if (this.points) {
            var points = this.points._latlngs;
            if (points.length === 1) { this._setPoint(ev.latlng, 1); }

            this._setPoint(ev.latlng, points.length - 1);
        }
    },

    _mousedown: function () {
console.log('_mousedown', this.mode, this._lastTime);
        this._lastTime = new Date().getTime() + 300;  // Hack for determinating map dragging
    },

    _mouseClick: function (ev) {
		var down = L.GmxDrawing.utils.getDownType.call(this, ev, this._map),
			points = this.points._latlngs;

		if (down.type === 'node' && down.end) {
			if (down.num === 0 || ((down.prev || L.Browser.mobile) && down.num === points.length - 1)) {
				this.setEditMode();
				if (!L.Browser.mobile) { points.pop(); }
                var len = points.length,
                    opt = this.options;
				if (len > 2 || (len > 1 && this.lineType)) {
					this.skipClick = true;

					if (down.num === 0 && this.lineType) {
						opt.type = 'Polygon';
					}
					this._setPoint(points[0], 0);
				} else {
					this.remove();
				}
				this._fireEvent('drawstop');
				return;
			}
		}

		this.addLatLng(ev.latlng);
		this._parent._parent._clearCreate();
    },

    _mouseup: function (ev) {
        if (new Date().getTime() < this._lastTime && this.mode === 'add') {
			this._mouseClick(ev);
        }
    }
});

L.GmxDrawing._Fill = L.Polyline.extend({
    options: {
        className: 'leaflet-drawing-lines-fill',
        opacity: 0,
        noClip: true,
        fill: true,
        fillOpacity: 0,
        size: 10,
        weight: 1
    },

    _getPathPartStr: function (points) {
        var size = this.options.size / 2,
            arr = L.GmxDrawing.utils.getEquidistancePolygon(points, 1.5 * size);

        for (var i = 0, len = arr.length, str = '', p; i < len; i++) {
            p = arr[i];
            str += 'M' + p[0][0] + ' ' + p[0][1] +
                'L' + p[1][0] + ' ' + p[1][1] +
                'L' + p[2][0] + ' ' + p[2][1] +
                'L' + p[3][0] + ' ' + p[3][1] +
                'L' + p[0][0] + ' ' + p[0][1];
        }
        return str;
    },
    _updatePath: function () {
        if (!this._map) { return; }

        this._clipPoints();

        L.Path.prototype._updatePath.call(this);
    }
});

L.GmxDrawing.PointMarkers = L.Polygon.extend({
    options: {
        className: 'leaflet-drawing-points',
        noClip: true,
		smoothFactor: 0,
        opacity: 1,
        shape: 'circle',
        fill: true,
        fillColor: '#ffffff',
        fillOpacity: 1,
        size: L.Browser.mobile ? 40 : 8,
        weight: 2
    },

    _getPathPartStr: function (points) {
        var round = L.Path.VML,
            size = this.options.size / 2,
            skipLastPoint = this._parent.mode === 'add' && !L.Browser.mobile ? 1 : 0,
            radius = (this.options.shape === 'circle' ? true : false);

        for (var j = 0, len2 = points.length - skipLastPoint, str = '', p; j < len2; j++) {
            p = points[j];
            if (round) { p._round(); }
            if (radius) {
                str += 'M' + p.x + ',' + (p.y - size) +
                       ' A' + size + ',' + size + ',0,1,1,' +
                       (p.x - 0.1) + ',' + (p.y - size) + ' ';
            } else {
                var px = p.x, px1 = px - size, px2 = px + size,
                    py = p.y, py1 = py - size, py2 = py + size;
                str += 'M' + px1 + ' ' + py1 + 'L' + px2 + ' ' + py1 + 'L' + px2 + ' ' + py2 + 'L' + px1 + ' ' + py2 + 'L' + px1 + ' ' + py1;
            }
        }
        return str;
    },

    _onMouseClick: function (e) {
        //if (this._map.dragging && this._map.dragging.moved()) { return; }

        this._fireMouseEvent(e);
    },

    _updatePath: function () {
        if (!this._map) { return; }
        this._path.setAttribute('fill-rule', 'inherit');

        this._clipPoints();

        L.Path.prototype._updatePath.call(this);
    }
});

L.GmxDrawing.utils = {
    getEquidistancePolygon: function(points, d) {   // get EquidistancePolygon from line
        var out = [];
        if (points.length) {
            var p = points[0];
            for (var i = 1, len = points.length; i < len; i++) {
                var p1 = points[i],
                    dx = p1.x - p.x,
                    dy = p1.y - p.y,
                    d2 = dx * dx + dy * dy;
                if (d2 > 0) {
                    var dp = d / Math.sqrt(d2),
                        x0 = p1.x + dp * dx,        y0 = p1.y + dp * dy,
                        x3 = p1.x - dx - dp * dx,   y3 = p1.y - dy - dp * dy,
                        y01 = y0 - p1.y,    x01 = p1.x - x0,
                        y30 = y3 - p.y,     x30 = p.x - x3;
                    out.push([
                        [x0 + y01, y0 + x01],
                        [x0 - y01, y0 - x01],
                        [x3 + y30, y3 + x30],
                        [x3 - y30, y3 - x30]
                    ]);
                }
                p = p1;
            }
        }
        return out;
    },

    getDownType: function(ev, map) {
        var layerPoint = ev.layerPoint,
            ctrlKey = false,
            latlng = ev.latlng;
        if (ev.originalEvent) {
            if (ev.originalEvent.ctrlKey) { ctrlKey = true; }
        }
        if (ev.touches && ev.touches.length === 1) {
            var first = ev.touches[0],
                containerPoint = map.mouseEventToContainerPoint(first);
            layerPoint = map.containerPointToLayerPoint(containerPoint);
            latlng = map.layerPointToLatLng(layerPoint);
        }
        var out = {type: '', latlng: latlng, ctrlKey: ctrlKey},
            ring = this.points ? this : ev.ring,
            points = ring.points._parts[0] || [],
            len = points.length;

        if (len === 0) { return out; }

        var size = (ring.points.options.size || 10) / 2;
        size += 1 + (ring.points.options.weight || 2);

        var cursorBounds = new L.Bounds(
            L.point(layerPoint.x - size, layerPoint.y - size),
            L.point(layerPoint.x + size, layerPoint.y + size)
            ),
            prev = points[len - 1];
        out = {
            type: 'node',
            latlng: latlng, ctrlKey: ctrlKey,
            num: 0,
            end: true
        };
        if (cursorBounds.contains(points[0])) {
			return out;
		}
        out.num = len - 1;
        out.prev = (len > 1 ? cursorBounds.contains(points[len - 2]) : false);
        if (cursorBounds.contains(prev)) {
			return out;
		}

        out = {latlng: latlng};
        for (var i = 0; i < len; i++) {
            var point = points[i];
            if (cursorBounds.contains(point)) {
                return {
                    type: 'node', num: i, end: (i === 0 ? true : false), ctrlKey: ctrlKey, latlng: latlng
                };
            }
            var dist = L.LineUtil.pointToSegmentDistance(layerPoint, prev, point);
            if (dist < size) { out = {type: 'edge', num: (i === 0 ? len : i), ctrlKey: ctrlKey, latlng: latlng}; }
            prev = point;
        }
        return out;
    }
};
})();
