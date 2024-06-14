/* MagicMirror²
 * Module: MMM-Netatmo
 *
 * By Christopher Fenner https://github.com/CFenner
 * MIT Licensed.
 */
const fs = require('fs')
const path = require('path')
const tokenCacheFileName = "token_cache.json";

module.exports = {
  notifications: {
    AUTH: 'NETATMO_AUTH',
    AUTH_RESPONSE: 'NETATMO_AUTH_RESPONSE',
    DATA: 'NETATMO_DATA',
    DATA_RESPONSE: 'NETATMO_DATA_RESPONSE',
  },
  start: function () {
    console.log('Netatmo helper started ...')
    this.token = null
  },

  authenticate: async function (config) {
    const self = this
    self.config = config

    try {
      const jsonData = fs.readFileSync(path.join(__dirname, tokenCacheFileName));
      var authorization_cacheData = JSON.parse(jsonData)
      self.refresh_token = authorization_cacheData.refresh_token;
      var refreshTimeoutmillis = Math.floor(authorization_cacheData.auth_token_expiry - Date.now());
      console.info(`Token is validate for: ${Math.floor((refreshTimeoutmillis / (1000 * 60 * 60)) % 24)} hour(s) and ${Math.floor((refreshTimeoutmillis / (1000 * 60 )) % 60)} min(s).`);
    
    } catch (e) { 
      console.info(`No credential cache found, using configuration refresh token.`);
      self.refresh_token = self.config.refreshToken;
    } 

    const params = new URLSearchParams()
    params.append('grant_type', 'refresh_token')
    params.append('refresh_token', self.refresh_token)
    params.append('client_id', self.config.clientId)
    params.append('client_secret', self.config.clientSecret)

    try {
      const result = await fetch('https://' + self.config.apiBase + self.config.authEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: params,
      }).then(response => response.json())

      if (result.error) {
        throw new Error(result.error)
      }

      // we got a new token, save it to main file to allow it to request the data
      console.log('Updating Tokens ...')
      self.token = result.access_token
      self.token_expires_in = result.expires_in
      self.refresh_token = result.refresh_token
      const authorization_data = {
        refresh_token: result.refresh_token,
        auth_token_expiry: Date.now() + (result.expires_in * 1000)
      };
      // converting the JSON object to a string
      const auth_data = JSON.stringify(authorization_data);
      // write to disk
      fs.writeFile(path.join(__dirname, tokenCacheFileName), auth_data, (error) => {
        // throwing the error
        // in case of a writing problem
        if (error) {
            // logging the error
            console.log("error " + error);
        } else console.log('Caching updated Refresh Token successful.')
      });
      
      self.sendSocketNotification(self.notifications.AUTH_RESPONSE, {
        status: 'OK',
      })
    } catch (error) {
      console.log('error:', error)
      self.sendSocketNotification(self.notifications.AUTH_RESPONSE, {
        payloadReturn: error,
        status: 'NOTOK',
        message: error,
      })
    } 
  },

  loadData: async function (config) {
    const self = this
    self.config = config

    if (self.config.mockData === true) {
      self.sendSocketNotification(self.notifications.DATA_RESPONSE, {
        payloadReturn: this.mockData(),
        status: 'OK',
      })
      return
    }
    if (self.token === null || self.token === undefined) {
      self.sendSocketNotification(self.notifications.DATA_RESPONSE, {
        payloadReturn: 400,
        status: 'INVALID_TOKEN',
        message: 'token not set',
      })
      return
    }

    try {
      let result = await fetch('https://' + self.config.apiBase + self.config.dataEndpoint, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${self.token}`,
        },
      })

      if (result.status === 403) {
        console.log('status code:', result.status, '\n', result.statusText)
        self.sendSocketNotification(self.notifications.DATA_RESPONSE, {
          payloadReturn: result.statusText,
          status: 'INVALID_TOKEN',
          message: result,
        })
        return
      }

      result = await result.json()

      if (result.error) {
        throw new Error(result.error.message)
      }

      self.sendSocketNotification(self.notifications.DATA_RESPONSE, {
        payloadReturn: result.body.devices,
        status: 'OK',
      })
    } catch (error) {
      console.log('error:', error)
      self.sendSocketNotification(self.notifications.DATA_RESPONSE, {
        payloadReturn: error,
        status: 'NOTOK',
        message: error,
      })
    }
  },
  mockData: function () {
    const sample = fs.readFileSync(path.join(__dirname, 'sample', 'sample.json'), 'utf8')
    return JSON.parse(sample)
  },
  socketNotificationReceived: function (notification, payload) {
    switch (notification) {
      case this.notifications.AUTH:
        this.authenticate(payload)
        break
      case this.notifications.DATA:
        this.loadData(payload)
        break
    }
  },
}
