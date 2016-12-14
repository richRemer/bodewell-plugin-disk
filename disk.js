const Resource = require("bodewell-resource");
const drives = require("nodejs-disks").drives;
const driveDetail = require("nodejs-disks").driveDetail;

const known = new Set();

/**
 * Disk resource.
 * @constructor
 * @param {string} dev
 */
function Disk(dev) {
    this.dev = dev;
}

/**
 * Discover attached disk resources.
 * @param {Service} service
 * @returns {Promise.<string[]>}
 */
Disk.discover = function(service) {
    service.trace("discovering disks");

    return new Promise((resolve, reject) => {
        drives((err, discovered) => {
            if (err) return reject(err);
            discovered = discovered.filter(d => d[0] === "/");

            // remove known disks which are no longer found
            Array.from(known.values())
                .filter(dev => !~discovered.indexOf(dev))
                .forEach(dev => {
                    known.delete(dev);
                    service.warn(`disk device disappeared [${dev}]`);
                });

            // add discovered disks which were previously unknown
            discovered
                .filter(dev => !Array.from(known.values()).some(d => d === dev))
                .forEach(dev => {
                    service.info(`disk discovered [${dev}]`);
                    known.add(dev);
                });

            resolve(Array.from(known.values()));
        });
    });
};
 
/**
 * Take a sample.
 * @returns {Promise}
 */
Disk.prototype.sample = function() {
    return new Promise((resolve, reject) => {
        driveDetail(this.dev, (err, usage) => {
            if (err) return reject(err);
            resolve(usage);
        });
    });
};

/**
 * Disk free-space.
 * @returns {number}
 */
Disk.prototype.valueOf = function() {
    var sampled = this.sampled(),
        free, total;

    if (!sampled) return undefined;
    free = bytesized(sampled.available.replace(/B$/, "iB"));
    total = bytesized(sampled.total.replace(/B$/, "iB"));
    return free / total;
};

Object.defineProperties(Disk.prototype, {
    /**
     * Free space from last sample.
     * @name Disk#free
     * @type {number}
     * @readonly
     */
    free: {
        configurable: true,
        enumerable: true,
        get: function() {
            if (!this.sampled()) return undefined;
            return bytesized(this.sampled().available);
        }
    },

    /**
     * Total space from last sample.
     * @name Disk#total
     * @type {number}
     * @readonly
     */
    total: {
        configurable: true,
        enumerable: true,
        get: function() {
            if (!this.sampled()) return undefined;
            return bytesized(this.sampled().total);
        }
    }
});

module.exports = function(bodewell) {
    var disk = new Resource(function() {
            return Math.min.apply(null, this.resources().map(Number));
        });

    bodewell.resource("Disk", Disk);
    bodewell.attachResource("disk", disk);
};

