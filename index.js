'use strict';

let Service;
let Characteristic;
const udp = require('./udp');

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory('homebridge-dohome-light', 'DoHomeLight', DoHomeLight);
};

function DoHomeLight(log, config) {
    this.log = log;
    this.name = config.name || 'DoHome Light';
    this.prodname = config.prodname;
    this.subnet = config.subnet || '192.168.100.255';
    this.port = config.port || 6091;
    this.deviceid = config.deviceid || this.prodname + "_DT-LIGHT_HOMEKIT"
}

DoHomeLight.prototype = {

    udpRequest: function (subnet, port, message, callback) {
        udp(subnet, port, message, function (err, returnmsg) {
            callback(err, returnmsg);
        });
    },

    setPowerState: function (targetService, powerState, callback, context) {

        // Callback safety
        if (context == 'fromSetPowerState') {
            if (callback) callback();
            return;
        }

        if (!this.prodname) {
            this.log.warn('No device specified');
            return;
        }

        const message =
            [
                powerState ?
                    "cmd=ctrl&devices={[" + this.prodname + "]}&op={\"cmd\":5, \"op\":1}" :
                    "cmd=ctrl&devices={[" + this.prodname + "]}&op={\"cmd\":5, \"op\":0}",
                this.deviceid
            ];

        this.udpRequest(this.subnet, this.port, message, function (error, returnmsg) {
            if (error) {
                this.log.error('setPowerState failed: ' + error.message);
                this.log('response: ' + response + '\nbody: ' + responseBody);
                callback(error);
            } else {
                this.log.info(returnmsg);
                if (returnmsg == "timeout") {
                    callback("timeout");
                } else {
                    this.log.info('==> ' + (powerState ? "On" : "Off"));
                }
            }
            callback();
        }.bind(this));

    },

    identify: function (callback) {
        callback();
    },

    getServices: function () {
        this.services = [];
        const informationService = new Service.AccessoryInformation();
        informationService
            .setCharacteristic(Characteristic.Manufacturer, 'www.doiting.com')
            .setCharacteristic(Characteristic.Model, 'DoHome-PA')
            .setCharacteristic(Characteristic.SerialNumber, this.deviceid);
        this.services.push(informationService);

        const lightService = new Service.Light(this.name);

        //Get current state
        let loopcount = 0;
        function loopuntilsuccess(wrapper, message) {
            wrapper.udpRequest(wrapper.subnet, wrapper.port, message, function (error, returnmsg) {
                if (error) {
                    wrapper.log.error('setPowerState failed: ' + error.message);
                    wrapper.log('response: ' + response + '\nbody: ' + responseBody);
                    callback(error);
                } else {
                    if (returnmsg == "timeout") {
                        loopcount++;
                        if (loopcount < 10)
                            loopuntilsuccess(wrapper, message)
                        else 
                        lightService.setCharacteristic(Characteristic.On,false)

                    } else {
                        lightService.setCharacteristic(Characteristic.On,returnmsg)
                    }
                }
                callback();
            }.bind(this));
        }
        
        loopuntilsuccess(this, [
            "cmd=ctrl&devices={[" + this.prodname + "]}&op={\"cmd\":25}",
            this.deviceid,
            "getServices"
        ])

        //Append State
        lightService
            .getCharacteristic(Characteristic.On)
            .on('set', this.setPowerState.bind(this, lightService))
        this.services.push(lightService);
        return this.services;
    }
};
