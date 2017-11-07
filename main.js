// Copyright (c) 2017 Gherardo Varando (gherardo.varando@gmail.com)
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

const {
  GuiExtension,
  util,
  Sidebar,
  Alert,
  Modal,
  Task
} = require('electrongui')
const path = require('path')
const {
  dialog
} = require('electron').remote
const {
  spawn
} = require('child_process')
const ConvertTask = require('./tasks/Convert.js')
const http = require('http')
const fs = require('fs')
const storage = require('electron-json-storage')


class BioFormatsExtension extends GuiExtension {

  constructor(gui, config) {
    super(gui, {
      image: path.join(__dirname, 'images', 'bio-formats.svg'),
      menuLabel: 'Bio-Formats',
      menuTemplate: [{
        label: 'Convert',
        click: () => this._convertDialog()
      }, {
        type: 'separator'
      }, {
        label: 'Configure',
        submenu: [{
          label: 'Local directory',
          click: () => this._configure()
        }, {
          label: 'Download and install',
          click: () => this.downloadBFtools()
        }]
      }]
    })
    this._configuration = {
      path: undefined
    }
    if (config && config.path) this._configuration.path = config.path
  }

  activate() {
    this.appendMenu()
    storage.get('bioformats-configuration', (error, data) => {
      if (error) return
      if (data) {
        this._configuration.path = (typeof data.path == 'string') ? data.path : undefined
        this._configuration.memory = (data.memory > 0) ? data.memory : this.maxMemory
        this._configuration.stackMemory = (data.stackMemory > 0) ? data.stackMemory : this.maxStackMemory
      }
    })
    //this.gui.alerts.add('MyExtension activated', 'default')
    super.activate()
  }

  _convertDialog() {
    let input = dialog.showOpenDialog({
      title: 'Select the image file to convert'
    })
    if (!input[0]) return
    let output = dialog.showSaveDialog({
      title: 'Where to save the converted image'
    })
    this.convert(input[0], output)
  }

  _configure() {
    dialog.showOpenDialog({
      title: 'Select the Bio-Formats tool directory',
      properties: ['openDirectory']
    }, (filepaths) => {
      if (filepaths[0]) {
        this._setPath(filepaths[0])
      }
    })
  }

  _setPath(path) {
    if (!typeof path === 'string') return
    this._configuration.path = path
    storage.set('bioformats-configuration', this._configuration, (err)=>{
      if (err){
        if (err) this.gui.alerts.add('Error saving Bio-Formats options','warning')
      }
    })
  }

  downloadBFtools(dir) {
    let {
      app
    } = require('electron').remote
    if (!dir) dir = app.getPath('appData')
    let filepath = path.join(dir, 'bioformats_package.jar')
    let target
    let file = fs.createWriteStream(filepath)
    let alert = this.gui.alerts.add('Downloading Bio-Formats...', 'progress')
    let request = http.get('http://downloads.openmicroscopy.org/bio-formats/5.7.1/artifacts/bioformats_package.jar', (response) => {
      response.pipe(file)
      file.on('finish', () => {
        alert.setBodyText('file downloaded')
        file.close(() => {
          this._setPath(dir)
          alert.remove()
          this.gui.alerts.add(`Bio-Formats downloaded and linked: \n file in ${dir}`, 'success')
        })
      })
    })
  }

  convert(input, output) {
    if (!input) return
    if (!output) return
    let task = new ConvertTask(input, output)
    this.gui.taskManager.addTask(task)
    task.run(this._configuration.path)
    task.on('error', (e) => {
      this.gui.alerts.add(`Error Bio-Formats converter: ${e.data}`, 'warning')
    })
    task.on('fail', (e) => {
      this.gui.alerts.add(`Failed Bio-Formats converter: ${e.error}`, 'danger')
    })
    task.on('success', (e) => {
      this.gui.alerts.add(`Completed Bio-Formats converter`, 'success')
    })
    task.on('message', (e) => {
      if (this._progressAlert) {
        this._progressAlert.setBodyText(e.data)
      } else {
        this._progressAlert = this.gui.alerts.add(`Bio-Formats converter \n file:${input} \n ${e.data}`, 'progress')
      }
    })
  }

}





module.exports = BioFormatsExtension
