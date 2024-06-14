/* eslint-disable no-mixed-spaces-and-tabs */
/* Magic Mirror
 * Module: Netatmo
 *
 * By Christopher Fenner http://github.com/CFenner
 * MIT Licensed.
 */

/* global $, moment, Module, Log, _aqiFeed*/
/* eslint no-undef: "error"*/

var ModuleNetatmoHidden = false; /// by default  display the module (if no carousel module or other)

var lastUpdateServeurNetatmo = 0; // Used to memorize the timestamp given by netatmo on the date of this info. New info every 10 min
var DateUpdateDataAirQuality = 0; // The last date we updated the info Air Quality min

var AirQualityImpact = 'Wait..'; 
var AirQualityValue = 0; //Initial air quality

 
Module.register('MMM-Netatmo', {
  // default config,
  defaults: {
  //for AirQuality
  lang: null,
	location: 'germany/berlin',
  initialDelay: 0,
	updateIntervalAirQuality: 600, // secondes = every 30 minutes  
  refreshToken: null,
  updatesIntervalDisplay: 60, 
  animationSpeed: 1000,
	updatesIntervalDisplayID: 0,
  apiBase: 'api.netatmo.com',
  authEndpoint: '/oauth2/token',
  dataEndpoint: '/api/getstationsdata',
  hideLoadTimer: false,
  mockData: false
  },
  
  notifications: {
    AUTH: 'NETATMO_AUTH',
    AUTH_RESPONSE: 'NETATMO_AUTH_RESPONSE',
    DATA: 'NETATMO_DATA',
    DATA_RESPONSE: 'NETATMO_DATA_RESPONSE'
  },

  // init method
  start: function() {
    const self = this
    Log.info('Starting module: ' + this.name);//First time at the launch of the mirror
    self.loaded = false
    self.moduleList = []

    // get a new access token at start-up. 
    setTimeout(function () {
      self.sendSocketNotification(self.notifications.DATA, self.config)
    }, this.config.initialDelay * 1000)


    this.loadAirQuality();
    // set auto-update
    setInterval(function () {
      // request directly the data, with the previous token. When the token will become invalid (error 403), it will be requested again
      self.sendSocketNotification(self.notifications.DATA, self.config)
    }, this.config.updatesIntervalDisplay * 60 * 1000 + this.config.initialDelay * 1000)

  },
  
	suspend: function() { // core called when the module is hidden
		ModuleNetatmoHidden = true; //module hidden
		Log.log("Suspend - Module Netatmo hidden");
		//this.GestionUpdateIntervalNetatmo(); //when called the function that handles all cases
	},
	
	resume: function() { // core called when the module is displayed
		ModuleNetatmoHidden = false;
		Log.log("Resume - Module Netatmo display");
		//this.GestionUpdateIntervalNetatmo();	
	},
	
	//Air Quality
	loadAirQuality: function(){

	//	Log.log("Fct loadAirQuality - OK DATA LOAD.");		
		_aqiFeed({
			lang: this.config.lang,
			city: this.config.location,
			callback: this.renderAirQuality.bind(this) // error log here when fct called 2 times too close. Not impact
		});
	},
	
	renderAirQuality: function(data){
			
		AirQualityValue = $(data.aqit).find("span").text();
		AirQualityImpact = data.impact;	
		
		//We memorize the date of our data upload
		DateUpdateDataAirQuality = Date.now() / 1000;
	},

  socketNotificationReceived: function (notification, payload) {
    const self = this
    Log.debug('received ' + notification)
    switch (notification) {
      case self.notifications.AUTH_RESPONSE:
        if (payload.status === 'OK') {
          self.sendSocketNotification(self.notifications.DATA, self.config)
        } else {
          Log.log('AUTH FAILED ' + payload.message)
        }
        break
      case self.notifications.DATA_RESPONSE:
        if (payload.status === 'OK') {
          Log.log('Devices %o', payload.payloadReturn)
          const stationList = payload.payloadReturn
          self.renderAll(stationList)
          self.updateDom(this.config.animationSpeed);
        } else if (payload.status === 'INVALID_TOKEN') {
          // node_module has no valid token, reauthenticate
          Log.log('DATA FAILED, refreshing token')
          self.sendSocketNotification(self.notifications.AUTH, self.config)
        } else {
          Log.log('DATA FAILED ' + payload.message)
        }
        break
    }
  },

  renderAll: function(data) {

    Log.log("Netatmo : renderAll");
    var device = data[0];
    this.lastUpdate = device.dashboard_data.time_utc;
   	lastUpdateServeurNetatmo = device.dashboard_data.time_utc;
    // render modules
    this.dom = this.getDesign('bubbles').render(device); 
  },
  
  renderError: function(reason) {
    Log.log("error " + reason);
  },
  formatter: {
    value: function(dataType, value) {
	  
    	//  Log.log("Netatmo : formatter - value");
      if(!value)
        return value;
      switch (dataType) {
        case 'CO2':
          return value.toFixed(0) + ' ppm';
        case 'Noise':
          return value.toFixed(0) + ' dB';
        case 'Humidity':
          return value.toFixed(0) + '%';
        case 'Rain':
          if (value > 0) return value.toFixed(0) + ' in/h';
          return 'NA';
        case 'Wind':
        case 'WindStrength':
          if (value > 0) return value.toFixed(0) + ' mph';
          return 'NA';
        case 'WindAngle':
          if (value < 0) return " ";
          var tailval = ' | ' + value + '°';
          if(value < 11.25)return 'N' + tailval;
          if(value < 33.75) return 'NNE'+ tailval;
          if(value < 56.25) return 'NE'+ tailval;
          if(value < 78.75) return 'ENE'+ tailval;
          if(value < 101.25) return 'E'+ tailval;
          if(value < 123.75) return 'ESE'+ tailval;
          if(value < 146.25) return 'SE'+ tailval;
          if(value < 168.75) return 'SSE'+ tailval;
          if(value < 191.25) return 'S'+ tailval;
          if(value < 213.75) return 'SSW'+ tailval;
          if(value < 236.25) return 'SW'+ tailval;
          if(value < 258.75) return 'WSW'+ tailval;
          if(value < 281.25) return 'W'+ tailval;
          if(value < 303.75) return 'WNW'+ tailval;
          if(value < 326.25) return 'NW'+ tailval;
          if(value < 348.75) return 'NNW'+ tailval;
          return 'N'+ tailval;
        case 'Battery':
          return value.toFixed(0) + '%';
        case 'WiFi':
        case 'Radio':
          return value.toFixed(0) + '%';
        case 'Pressure':
          return(value*0.02953).toFixed(0) + ' inHg';
        case 'Temperature':
          return ((value*9)/5+32).toFixed(1) + '°';
        case 'min_temp':
        case 'max_temp':
          return ((value*9)/5+32).toFixed(1) + '°';
        default:
          return value;
      }
    }
  },

  clazz: function(dataType) {
    switch (dataType) {
      case 'CO2':
        return 'wi-na';
      case 'Noise':
        return 'wi-na';
      case 'Humidity':
        return 'wi-humidity';
      case 'Pressure':
        return 'wi-barometer';
      case 'Temperature':
        return 'wi-thermometer';
      case 'Rain':
        return 'wi-raindrops';
      case 'Wind':
        return 'wi-na';
      default:
        return '';
    }
  },
  
  getDesign: function(design){
  	 
    var that = this;
    var formatter = this.formatter;
    var translator = this.translate;
    var WindValue = -1; 
    var WindAngleValue = -1;
    var RainValue = -1;
  

    return {
      bubbles: (function(formatter, translator, that){ 
        return {
          moduleType: {
            MAIN: "NAMain",
            INDOOR: "NAModule4",
            OUTDOOR: "NAModule1",
            RAIN: "NAModule3",
            WIND: "NAModule2"
          },
          render: function(device){
            var sResult = $('<div/>').addClass('modules').addClass('bubbles');
            var aOrderedModuleList = that.config.moduleOrder && that.config.moduleOrder.length > 0 ?
              that.config.moduleOrder :
              null;

            if (aOrderedModuleList) {
              for (var moduleName of aOrderedModuleList) {
                if (device.module_name === moduleName) {
                  sResult.append(this.module(device));
                } else {
                  for (var module of device.modules) 
                  {
                    //Log.log(module.module_name);
                    //Log.log(module.type);
                    if (module.module_name === moduleName)
                    {
                      switch(module.type)
                      {
                        case this.moduleType.MAIN:
                        case this.moduleType.INDOOR:
                        case this.moduleType.OUTDOOR:
                          sResult.append(this.module(module));
                        break;
      
                        case this.moduleType.WIND:
                          if (module.dashboard_data === undefined) {
                            break;
                          }
                          WindValue = module.dashboard_data['WindStrength'];
                          WindAngleValue = module.dashboard_data['WindAngle'];
                          
                        break;
                  
                        case this.moduleType.RAIN:
                          if (module.dashboard_data === undefined) {
                              break;
                          }
                          RainValue = module.dashboard_data['Rain'];
                          
                        break; 
                      } 

                      break;
                    }
                  }
                }
              }
            } else {
              // render station data (main station)
              sResult.append(this.module(device));
              // render module data (connected modules)
              for (var cnt = 0; cnt < device.modules.length; cnt++) 
              {
                switch(device.modules[cnt].type)
                {
                  case this.moduleType.MAIN:
                  case this.moduleType.INDOOR:
                  case this.moduleType.OUTDOOR:
                    sResult.append(this.module(device.modules[cnt]));
                  break;

                  case this.moduleType.WIND:
                    if (device.modules[cnt].dashboard_data === undefined) {
                      break;
                    }
                   WindValue = device.modules[cnt].dashboard_data['WindStrength'];
                   WindAngleValue = device.modules[cnt].dashboard_data['WindAngle'];
                    
                  break;
            
                  case this.moduleType.RAIN:
                    if (device.modules[cnt].dashboard_data === undefined) {
                        break;
                     }
                    RainValue = device.modules[cnt].dashboard_data['Rain'];
                  break; 
                }  
              }
            }
            return sResult;
          },
          
          //Defined the overall structure of the display of each element of the module (indoor, outdoor). The last line being in the getDom
          module: function(module){
            var result = $('<div/>').addClass('module').append(
                    $('<div/>').addClass('name small').append(module.module_name)
                  ).append(
                    $('<div/>').append(
                      $('<table/>').append(
                        $('<tr/>').append(
                          this.displayTemp(module)
                        ).append(
                          this.displayExtra(module)
                        )//finsh tr
                      )//finsh table
                    )//finsh div
                  ).append(
                    $('<div/>').addClass('align-left').append(this.displayInfos(module))
                  ).append(
                    $('<div/>').addClass('line')
                  );
              return result[0].outerHTML;
          },
          
          displayTemp: function(module){
            var result = $('<td/>').addClass('displayTemp');
            var type;
            var value;
            var valueTrend;
            var valueMin;
            var valueMax;
            var TrendIcon;
            switch(module.type){
              case this.moduleType.MAIN:
              case this.moduleType.OUTDOOR:
                type = 'Temperature';
                if (module.dashboard_data === undefined) {
                  value = "NA";
                  valueMin = "NA";
                  valueMax = "NA";
                  valueTrend = "";
                }
                else
                {
                 value = module.dashboard_data[type];
                 valueMin = module.dashboard_data['min_temp'];
                 valueMax = module.dashboard_data['max_temp'];
                 valueTrend = module.dashboard_data['temp_trend'];
                }
                
                // Log.log("getDesign - Temperature : " + value + ' C');

                if (valueTrend == 'up'){
                  TrendIcon = 'fa fa-arrow-up';
                }else if (valueTrend == 'stable'){
                  TrendIcon = 'fa fa-arrow-right';
                }else if (valueTrend == 'down'){
                  TrendIcon = 'fa fa-arrow-down';
                }else{
                  TrendIcon = 'fa fa-question';
                }
                
                $('<div/>').addClass(type).append(                 
                  $('<div/>').addClass('large light bright').append(formatter.value(type, value))
                ).append(                  
                  $('<span/>').addClass('updated xsmall').addClass(TrendIcon)
                ).append(
                  $('<span/>').addClass('small light').append(' ' + formatter.value(type, valueMin) + ' - ' + formatter.value(type, valueMax))
                )
                .appendTo(result);
              break;
              case this.moduleType.INDOOR:
                  type = 'Temperature';
                  if (module.dashboard_data === undefined)
                    value = "NA";
                  else
                    value = module.dashboard_data[type];
                    
                  $('<div/>').addClass(type).append(                 
                    $('<div/>').addClass('x-medium light bright').append(formatter.value(type, value))
                  ).appendTo(result);
                  
                
              break; 
              default:
            }
            return result;
          },

          displayHum: function(module){
            var result;
            var value = "";
            var type = 'Humidity'; 
            switch(module.type){
              case this.moduleType.MAIN:             
             
              result = $('<div/>').addClass('displayHum');
              if (module.dashboard_data === undefined)
                value = "NA";
              else
                value = module.dashboard_data[type];			
				
				      if (value >= 40 && value <= 60){
					      status = '';
				      }else if (value < 40 && value > 30 || value < 70 && value > 60){
					      status = 'textorange';
				      }else if (value <= 30 || value >= 70){
				      	status = 'textred';
              }
              
              $('<div/>').addClass(type)
              .append(
              $('<div/>').addClass('fa fa-tint').addClass(status)
              ).append(
              $('<span/>').addClass('small value').append('  Humidity: '+ formatter.value(type, value))
              ).appendTo(result);
              
              break;
              case this.moduleType.OUTDOOR:
              case this.moduleType.INDOOR:
              default:
                break;
            }
            return result;
          },

          displayExtra: function(module){
            var result = $('<td/>').addClass('displayExtra');
            var valueCO2 = 0;
            var statusCO2 = 0;
            switch(module.type){
              case this.moduleType.MAIN:
                if (module.dashboard_data === undefined)
                  valueCO2 = 1000;
                else
                  valueCO2 = module.dashboard_data['CO2'];      
                  statusCO2 = valueCO2 > 2000?'bad':valueCO2 > 1000?'average':'good';

                $('<div/>').addClass('').append(
                  $('<div/>').addClass('small value').append('CO² : ' + formatter.value('CO2', valueCO2))
                ).append(
                  $('<div/>').addClass('visual small').addClass(statusCO2)
                ).append(
                  this.displayHum(module)     
                ).appendTo(result);   
              break;
                    
              case this.moduleType.INDOOR:
                valueCO2 = 0;
                if (module.dashboard_data === undefined)
                  valueCO2 = 1000;
                else
                  valueCO2 = module.dashboard_data['CO2'];     
                  statusCO2 = valueCO2 > 2000?'bad':valueCO2 > 1000?'average':'good';

                $('<div/>').addClass('').append(
                  $('<div/>').addClass('small value').append('CO² : ' + formatter.value('CO2', valueCO2))
                ).append(
                  $('<div/>').addClass('visual-s small').addClass(statusCO2)  
                ).appendTo(result);                  
                
              break;
            
              case this.moduleType.OUTDOOR:
              // Display the AirQuality base on Air Quality and Pollution Measurement. 
              var statusAirQuality = isNaN(AirQualityValue)?'textgray'
              :AirQualityValue < 51?'textgreen'
              :AirQualityValue < 101?'textyellow'
              :AirQualityValue < 151?'textorange'
              :AirQualityValue < 201?'textred'
              :AirQualityValue < 301?'textpurple'
              :'textdeepred';
          
              $('<div/>').addClass('').append(
					    $('<div/>').addClass('medium light').append(AirQualityImpact)
              ).append(
					    $('<span/>').addClass('fa fa-leaf').addClass(statusAirQuality)
				      ).append(
					    $('<span/>').addClass('small value').append(' AQI: ' + AirQualityValue)
              ).appendTo(result);
              break;

              default:
                break;
            }
            return result;
          },
          
          displayInfos: function(module){ //add additional information module at the bottom
            var result = $('<td/>').addClass('');
            var valuePressure = 0;
            var valueNoise = 0;
            switch(module.type){
              case this.moduleType.MAIN: //the main interior module

                var valueWiFi = module.wifi_status;
                if (module.dashboard_data === undefined)
                {
                  valuePressure = 0;
                  valueNoise = 0;
                }
                else
                {
                  valuePressure = module.dashboard_data['Pressure'];
                  valueNoise = module.dashboard_data['Noise'];
                }
				        var statusWiFi = valueWiFi < 40?'textred':'';
                    
                //70dB vacuum cleaner. 40dB: library 
				        var statusNoise = valueNoise > 70?'fa fa-volume-up':valueNoise > 50?'fa fa-volume-down':'fa fa-volume-off';
                var statusNoiseQuality =  valueNoise > 70?'textred':valueNoise > 50?'textorange':'';

				        // print information
				        $('<td/>').addClass('').append(
                  $('<span/>').addClass('fa fa-wifi').addClass(statusWiFi)
                ).append(
                  $('<span/>').addClass('updated xsmall').append(' WiFi: ' + formatter.value('WiFi', valueWiFi) + '  ')
                ).append(
                  $('<span/>').addClass('fa fa-thermometer-half')
                ).append( 
                  $('<span/>').addClass('updated xsmall').append(' Pressure: ' + formatter.value('Pressure', valuePressure ) + ' ')
                ).append(
                  $('<span/>').addClass(statusNoise).addClass(statusNoiseQuality)
                ).append(
                  $('<span/>').addClass('updated xsmall').append(' Noise: ' + formatter.value('Noise', valueNoise))
                ).append(
                    $('<div/>').addClass('line')
                ) .appendTo(result);   
                    
              break;

              case this.moduleType.INDOOR:  
                                          
                var valueBattery = module.battery_percent;
                var valueRadio = module.rf_status;
                var valueHum = 0;
       
                // Set battery and radio status color
                var statusBattery = valueBattery < 30?'textred fa fa-battery-1 fa-fw':valueBattery < 70?'fa fa-battery-2 fa-fw':'fa fa-battery-4 fa-fw';
                var statusRadio = valueRadio < 30?'textred':'';
                if (module.dashboard_data === undefined)
                  valueHum = 0;
                else
                  valueHum = module.dashboard_data['Humidity'];

                var statusHum;
                // Set humidity status color
                if (valueHum >= 40 && valueHum <= 60){
                  statusHum = '';
                  }else if (valueHum < 40 && valueHum > 30 || valueHum < 70 && valueHum > 60){
                  statusHum = 'textorange';
                  }else if (valueHum <= 30 || valueHum >= 70){
                  statusHum = 'textred';
                }

                // print information
                $('<td/>').addClass('').append(
                  $('<span/>').addClass(statusBattery)
                ).append(
                  $('<span/>').addClass('updated xsmall').append(formatter.value('Battery', valueBattery) + ' ')
                ).append(
                  $('<span/>').addClass('fa fa-signal fa-fw').addClass(statusRadio)
                ).append(
                  $('<span/>').addClass('updated xsmall').append(' Radio: ' + formatter.value('Radio', valueRadio) + ' ')
                ).append(
                  $('<span/>').addClass('fa fa-tint').addClass(statusHum)
                ).append(
                  $('<span/>').addClass('updated xsmall').append(' Humidity: ' + formatter.value('Humidity', valueHum))
                ).append(
                  $('<div/>').addClass('line')
                ).appendTo(result);                                     
                
              break;
                
              case this.moduleType.OUTDOOR: 
                                          
                valueBattery = module.battery_percent;
                valueRadio = module.rf_status;
                valueHum = 0;
                // Set battery and radio status color
                statusBattery = valueBattery < 30?'textred fa fa-battery-1 fa-fw':valueBattery < 70?'fa fa-battery-2 fa-fw':'fa fa-battery-4 fa-fw';
                statusRadio = valueRadio < 30?'textred':'';

                 // Set humidity status color
                 if (module.dashboard_data === undefined)
                  valueHum = 0;
                else
                  valueHum = module.dashboard_data['Humidity'];

                if (valueHum >= 40 && valueHum <= 60){
                  statusHum = '';
                  }else if (valueHum < 40 && valueHum > 30 || valueHum < 70 && valueHum > 60){
                  statusHum = 'textorange';
                  }else if (valueHum <= 30 || valueHum >= 70){
                  statusHum = 'textred';
                }

                // print information
                $('<div/>').addClass('').append(
                  $('<span/>').addClass(statusBattery)
                ).append(
                  $('<span/>').addClass('updated xsmall').append(formatter.value('Battery', valueBattery) + ' ')
                ).append(
                  $('<span/>').addClass('fa fa-signal fa-fw').addClass(statusRadio)
                ).append(
                  $('<span/>').addClass('updated xsmall').append(' Radio: ' + formatter.value('Radio', valueRadio) + ' ')
                ).append(
                   $('<span/>').addClass('fa fa-tint').addClass(statusHum)
                ).append(
                  $('<span/>').addClass('updated xsmall').append(' Humidity: ' + formatter.value('Humidity', valueHum))
                ).append(
                  $('<div/>').append(
                    $('<table/>').append(
                      $('<tr/>')
                        .append(
                          $('<span/>').addClass('wi wi-rain')
                        ).append(
                          $('<span/>').addClass('updated xsmall').append('Rain: ' + formatter.value('Rain',RainValue ) + ' ')
                        ).append(
                          $('<span/>').addClass('wi wi-strong-wind')
                        ).append(
                          $('<span/>').addClass('updated xsmall').append('Wind: ' + formatter.value('Wind',WindValue ) + ' ')
                        ).append(
                           $('<span/>').addClass('updated xsmall').append(formatter.value('WindAngle', WindAngleValue))
                      )//finsh tr
                    )//finsh table
                  )//finsh div
                ).append(
                  $('<div/>').addClass('line')  
                )
                .appendTo(result);                                     
              break;

              default:
                break;
            }
            return result;
          }
        };
      })(formatter, translator, that) // end of the bubbles design
    }[design]
  },

  getScripts: function() {
//	      Log.log("Netatmo : getScripts");
    return [
      'aqiFeed.js', //AirQuality
      'String.format.js',
      '//cdnjs.cloudflare.com/ajax/libs/jquery/2.2.2/jquery.js',
      'q.min.js',
      'moment.js'
    ];
  },
  getStyles: function() {
	    // Log.log("Netatmo : getStyles");
      return ['netatmo.css', 'font-awesome.css', 'weather-icons.css'];
  },
	
  getTranslations: function() {
    //Log.log("Netatmo : getTranslations");
    return {
      en: 'l10n/en.json',
      de: 'l10n/de.json',
      fr: 'l10n/fr.json',
      cs: 'l10n/cs.json',
      nb: 'l10n/nb.json'
    };
  },
  
  getDom: function() {
	     
	Log.log("Netatmo : getDom");
    var dom = $('<div/>').addClass('netatmo').addClass(this.config.design);
    if(this.dom){
      dom.append(
        this.dom
      ).append(
        $('<div/>')
          .addClass('updated xsmall')
          .append(moment(new Date(1000 * this.lastUpdate)).fromNow())
          //.append(moment(new Date('December 17, 1995 03:24:00')))
      );
      if(!this.config.hideLoadTimer){
        dom.append($(
          '<svg class="loadTimer" viewbox="0 0 250 250">' +
          '  <path class="border" transform="translate(125, 125)"/>' +
          '  <path class="loader" transform="translate(125, 125) scale(.84)"/>' +
          '</svg>'
        ));
      }

    }else{ 
      dom.append($(
        '<svg class="loading" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid">' +
        '  <circle class="outer"></circle>' +
        '  <circle class="inner">' +
        '    <animate attributeName="stroke-dashoffset" dur="5s" repeatCount="indefinite" from="0" to="502"></animate>' +
        '    <animate attributeName="stroke-dasharray" dur="5s" repeatCount="indefinite" values="150.6 100.4;1 250;150.6 100.4"></animate>' +
        '  </circle>' +
        '</svg>'
      ));
    }
    return dom[0];
  }
});
