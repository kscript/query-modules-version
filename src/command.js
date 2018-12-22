var path = require('path');
var vscode = require('vscode');
var Util = require('./utils');
var files = require('./files');
var window = vscode.window;

var disposables = [];
var terminalInstance = null;

var formatPackage = function (data) {
  var packageJSON = {};
  try {
    packageJSON = JSON.parse(data);
    packageJSON.dependencies = packageJSON.dependencies || {}
    packageJSON.devDependencies = packageJSON.devDependencies || {}
  } catch (e) {
    packageJSON = {
      dependencies: {},
      devDependencies: {}
    }
  }
  return packageJSON
}
var hasMember = function (list, key, val) {
  var has = false;
  if (!list || !(list instanceof Array) || !list.length) {
    return false;
  }
  for (var i = 0, len = list.length; i < len && !has; i++) {
    has = list[key] === val;
  }
  return has;
}
var Terminal = function (window, name) {
  return window.createTerminal(name || 'cmd');
}

var cdProjectPath = function (terminal, context) {
  // TODO 后期需对项目目录进行判断
  var isProjectPath = false;

  if (isProjectPath) {
    // 如果是项目目录, 什么都不做
    // ...
  } else {
    terminal.sendText("cd " + context.fsDir);
  }
}

module.exports = {
  npmInstall: function (context) {
    var that = this;
    var terminal = that.terminal();
    try {
      files.readFile(path.join(context.fsDir, 'package.json'), function (err, data) {
        if (err) {
          window.showErrorMessage("未找到 package.json 文件");
        } else {
          cdProjectPath(terminal, context);
          terminal.show();
          terminal.sendText("npm i");
        }
      });
    } catch (e) {
      console.log(e);
    }
  },
  queryPackageVersion: function (context) {
    var fsDir = context.fsPath;
    files.readFile(path.join(fsDir, 'package.json'), function (err, data) {
      if (err) {
        window.showErrorMessage("未找到 package.json 文件");
      } else {
        var package = JSON.parse(data);
        var out = package;
        files.fsStat(path.join(fsDir, 'node_modules'), function (error, stat) {
          if (error) {
            window.showErrorMessage("未找到 node_modules 目录");
          } else {
            package.dependencies && (out.dependencies = Util.queryModuleVersion(package.dependencies, fsDir));
            package.devDependencies && (out.devDependencies = Util.queryModuleVersion(package.devDependencies, fsDir));
            if (Util.isEmpty(out.dependencies) && Util.isEmpty(out.devDependencies)) {
              window.showInformationMessage("查询依赖版本完毕! 依赖为空!");
            } else {
              Util.outPackage(fsDir, window, out);
            }
          }
        })
      };
    });
  },
  moduleHandlerByType: function (context, type, func) {
    this.moduleHandler(context, function (hasModule, selected, terminal) {
      // 如果回调不存在, 或返回true
      if (!func || func(hasModule, selected, terminal)) {
        hasModule[0] && terminal.sendText("npm " + type + " " + selected + ' -S');
        hasModule[1] && terminal.sendText("npm " + type + " " + selected + ' -D');
      }
    })
  },
  moduleHandler: function (context, func) {
    var that = this;
    var selected = Util.extractModule(window);
    var terminal = that.terminal();
    selected && files.readFile(context.fsPath, function (err, data) {
      if (err) {
        return;
      }
      var packageJSON = formatPackage(data);
      var hasModule = [packageJSON.dependencies[selected], packageJSON.devDependencies[selected]]
      if (hasModule[0] || hasModule[1]) {
        try {
          cdProjectPath(terminal, context);
          terminal.show();
          func && func(hasModule, selected, terminal);
        } catch (e) {
          console.log(e)
        }
      } else {
        window.showErrorMessage("选择模块无效!");
      }
    })
  },
  moduleUninstall: function (context, type) {
    var that = this;
    var selected = Util.extractModule(window);
    var terminal = that.terminal();
    selected && files.fsStat(path.join(context.fsDir, 'node_modules', selected), function (error, stat) {
      if (error) {
        window.showInformationMessage("未找到 " + selected + " 模块, 卸载结束!");
      } else {
        files.readFile(context.fsPath, function (err, data) {
          if (err) {
            return;
          }
          var packageJSON = formatPackage(data);
          var hasModule = [packageJSON.dependencies[selected], packageJSON.devDependencies[selected]]
          if (hasModule[0] || hasModule[1]) {
            try {
              cdProjectPath(terminal, context);
              terminal.show();
              hasModule[0] && terminal.sendText("npm " + type + " " + selected + ' -S');
              hasModule[1] && terminal.sendText("npm " + type + " " + selected + ' -D');
            } catch (e) {
              console.log(e)
            }
          }
        })
      }
    });
  },

  registerCommand: function (command, func) {
    return disposables = disposables.concat(
      vscode.commands.registerCommand(command, function (context) {
        try {
          files.currentPath(context, function (err, context) {
            func && func(context);
          });
        } catch (e) {
          console.log(e);
        }
      })
    );
  },
  registerCommands: function (commands) {
    var that = this;
    var result = [];
    if (commands instanceof Object) {
      if (commands instanceof Array) {
        for (var i = 0; i < commands.length; i++) {
          result.push(that.registerCommand.apply(that, commands));
        }
      } else {
        for (var com in commands) {
          if (commands.hasOwnProperty(com)) {
            result.push(that.registerCommand.call(that, com, commands[com]));
          }
        }
      }
    }
    return disposables = disposables.concat(result);
  },
  terminal: function () {
    if (terminalInstance) {
      try {
        var id = terminalInstance._id;
        var terminals = window.terminals || [];
        var isRuning = hasMember(terminals, '_id', id);
        if (isRuning) {
          return terminalInstance;
        }
      } catch (e) {
        console.log(e);
      }
    }
    return terminalInstance = Terminal(window, 'npm module helper');
  }
};
