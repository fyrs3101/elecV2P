const express = require('express')

const { logger, setGlog, CONFIG_FEED, CONFIG_Axios, list, file } = require('../utils')
const clog = new logger({ head: 'wbconfig' })

const { CONFIG } = require('../config')
const { CONFIG_RUNJS, CONFIG_RULE } = require('../script')

module.exports = app => {
  const dyn = dynStatic(file.get(CONFIG.efss.directory, 'path'))
  app.use('/efss', dyn)

  function dynStatic(path) {
    let static = express.static(path, { dotfiles: (CONFIG.efss.dotshow && CONFIG.efss.dotshow.enable) ?  'allow' : 'deny' })
    const dyn = (req, res, next) => static(req, res, next)

    dyn.setPath = (newPath) => {
      static = express.static(newPath, { dotfiles: (CONFIG.efss.dotshow && CONFIG.efss.dotshow.enable) ?  'allow' : 'deny' })
    }
    return dyn
  }

  function efssSet(cefss){
    if (cefss.enable === false) {
      clog.notify('efss is closed')
      return {
        rescode: 0,
        message: 'efss is closed'
      }
    } else {
      const efssF = file.get(cefss.directory, 'path')
      if (file.isExist(efssF)) {
        clog.notify('efss directory set to', cefss.directory)
        dyn.setPath(efssF)
        return {
          rescode: 0,
          message: 'reset efss directory success!'
        }
      } else {
        clog.error(cefss.directory + ' dont exist')
        return {
          rescode: 404,
          message: cefss.directory + ' dont exist'
        }
      }
    }
  }

  app.get("/config", (req, res)=>{
    let type = req.query.type
    clog.notify((req.headers['x-forwarded-for'] || req.connection.remoteAddress), "get config data", type)
    switch(req.query.type){
      case 'setting':
        res.end(JSON.stringify({
          homepage: CONFIG.homepage,
          gloglevel: CONFIG.gloglevel || 'info',
          CONFIG_FEED, CONFIG_RUNJS, CONFIG_Axios,
          uagent: CONFIG_RULE.uagent,
          wbrtoken: CONFIG.wbrtoken,
          minishell: CONFIG.minishell || false,
          security: CONFIG.SECURITY || {},
          init: CONFIG.init
        }))
        break
      default:{
        res.end('no config data to get')
      }
    }
  })

  app.put("/config", (req, res)=>{
    clog.notify((req.headers['x-forwarded-for'] || req.connection.remoteAddress) + " put config " + req.body.type)
    let bSave = true
    switch(req.body.type){
      case "config":
        let data = req.body.data
        Object.assign(CONFIG, data)
        if (CONFIG.CONFIG_FEED) CONFIG.CONFIG_FEED.homepage = CONFIG.homepage
        Object.assign(CONFIG_FEED, CONFIG.CONFIG_FEED)
        Object.assign(CONFIG_RUNJS, CONFIG.CONFIG_RUNJS)
        Object.assign(CONFIG_Axios, CONFIG.CONFIG_Axios)
        if (data.gloglevel !== CONFIG.gloglevel) setGlog(data.gloglevel)
        res.end("save config to " + CONFIG.path)
        break
      case "homepage":
        let homepage = req.body.data.replace(/\/$/, '')
        CONFIG.homepage = homepage
        CONFIG_FEED.homepage = homepage
        res.end('set homepage success!')
        break
      case "gloglevel":
        try {
          CONFIG.gloglevel = req.body.data
          setGlog(CONFIG.gloglevel)
          res.end('全局日志级别调整为 ' + CONFIG.gloglevel)
        } catch(e) {
          res.end('全局日志级别调整失败 ' + e.message)
          clog.error('全局日志级别调整失败 ' + e.message)
        }
        break
      case "wbrtoken":
        CONFIG.wbrtoken = req.body.data
        clog.notify('webhook token set to', CONFIG.wbrtoken)
        res.end('webhook token set success!')
        break
      case "eAxios":
        try {
          Object.assign(CONFIG_Axios, req.body.data)
          CONFIG.CONFIG_Axios = CONFIG_Axios
          res.end('success! set eAxios')
        } catch(e) {
          res.end('fail to change eAxios setting')
          console.error(e)
        }
        break
      case "uagent":
        if (req.body.data) {
          CONFIG_RULE.uagent = req.body.data
          list.put('useragent.list', JSON.stringify(req.body.data, null, 2))
          res.end('success update User-Agent list')
        } else {
          res.end('no data to update')
        }
        bSave = false
        break
      case "runjs":
        try {
          Object.assign(CONFIG_RUNJS, req.body.data)
          CONFIG.CONFIG_RUNJS = CONFIG_RUNJS
          res.end(JSON.stringify({
            rescode: 0,
            message: 'RUNJS config changed'
          }))
        } catch(e) {
          res.end(JSON.stringify({
            rescode: -1,
            message: 'fail to change RUNJS config' + e.message
          }))
        }
        break
      case "efss":
        let msg = efssSet(req.body.data)
        if (msg.rescode === 0) {
          Object.assign(CONFIG.efss, req.body.data)
        }
        res.end(JSON.stringify(msg))
        break
      case "security":
        CONFIG.SECURITY = req.body.data
        if (CONFIG.SECURITY.enable === false) {
          res.end('security access is cancelled.')
        } else {
          res.end('updata saved!')
        }
        break
      case "init":
        CONFIG.init = Object.assign(CONFIG.init || {}, req.body.data)
        if (req.body.data.runjs) {
          res.end('add initialization runjs: ' + req.body.data.runjs)
        } else {
          res.end('initialization runjs is cleared')
        }
        break
      default:{
        bSave = false
        res.end("data put error, unknow type: " + req.body.type)
      }
    }
    if (bSave) {
      clog.info('current config save to script/Lists/config.json')
      list.put('config.json', JSON.stringify(CONFIG, null, 2))
    }
  })
}