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
// console.log('_fireEvent', name);
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

        var res = L.GmxDrawing.utils.getNotDefaults(data, L.GmxDrawing.utils.defaultStyles);
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
                var _gtxt = function (key) {
                    var res = L.gmxLocale ? L.gmxLocale.getText(key) : null;
                    return res || key;
                };
                var my = this;
                this._showTooltip = function (type, ev) {
                    var ring = ev.ring,
                        originalEvent = ev.originalEvent,
                        down = originalEvent.buttons || originalEvent.button;
                    if (ring.downObject || !down) {
//console.log('eeeeee', my._leaflet_id);
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
                            var _latlngs = ring.points._latlngs;
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
                    this._parent.hideTooltip();
                    this._fireEvent('onMouseOut');
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