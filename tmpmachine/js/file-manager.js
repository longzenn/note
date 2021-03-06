let fileManager = new FileManager();
let activeFile;
let activeFolder = -1;

let lastClickEl;
let selectedFile = [];
let clipBoard = [];
let doubleClick = false;

let fileTab = [];
let activeTab = 0;

let breadcrumbs = [{folderId:'-1',title:'My Files'}];

function File(data = {}) {
  
  let file = fs.new('files');
  
  let predefinedData = {
    fid: fs.data.counter.files,
    name: 'Untitled File',
    content: $('#editor').env.editor.getValue(),
    description: fileManager.getDescription(),
    loaded: true,
    parentId: activeFolder,
    modifiedTime: new Date().toISOString(),
  };
  
  for (let key in predefinedData) {
    if (file.hasOwnProperty(key))
      file[key] = predefinedData[key];
  }
  
  for (let key in data) {
    if (file.hasOwnProperty(key))
      file[key] = data[key];
  }
  
  fs.data.counter.files++;
  fs.data.files.push(file);
  
  // fileManager.sync(file.fid, action, 'files');
  // if (isAutoSync)
  //   drive.syncToDrive();
  // if (refreshDirectory)
  //   fileManager.list();
  return file;
}

function Folder(data = {}) {
  
  let file = fs.new('folders');
  
  let predefinedData = {
    fid: fs.data.counter.folders,
    name: 'New Folder',
    parentId: activeFolder,
    modifiedTime: new Date().toISOString(),
  };
  
  for (let key in predefinedData) {
    if (file.hasOwnProperty(key))
      file[key] = predefinedData[key];
  }
  
  for (let key in data) {
    if (file.hasOwnProperty(key))
      file[key] = data[key];
  }
  
  fs.data.counter.folders++;
  fs.data.folders.push(file);
  fs.save();
  
  // fileManager.sync(file.fid, action, 'folders');
  // if (isAutoSync)
  //   drive.syncToDrive();
  // if (refreshDirectory)
  //   fileManager.list();
  return file;
}


function FileManager() {
  
  function listFolders() {
    let folders = odin.filterData(activeFolder, fs.data.folders, 'parentId');
    folders.sort(function(a, b) {
      return (a.name.toLowerCase() < b.name.toLowerCase()) ? -1 : 1;
    });
    for (let f of folders) {
      if (f.trashed) continue;
      let el = o.cel('div',{innerHTML:o.creps('tmp-folder-list',f)});
      $('#file-list').appendChild(el);
    }
  }
  
  function listFiles() {
    $('#file-list').appendChild(o.cel('div', { style: 'flex: 0 0 100%', class: 'w3-padding-small' }));
    let files = odin.filterData(activeFolder, fs.data.files, 'parentId');
    files.sort(function(a, b) {
      return (a.name.toLowerCase() < b.name.toLowerCase()) ? -1 : 1;
    });
    for (let {fid, name, trashed} of files) {
      if (trashed) continue;
      
      let clsLock = '';
      let defaultBg = '#777';
      
      defaultBg = getFileColor(name);
        
      if (fid === locked)
        clsLock = 'w3-text-purple';
      
      let el = o.cel('div',{ innerHTML: o.creps('tmp-file-list', {
        fid,
        name,
        defaultBg,
        clsLock
      }) });
      
      $('#file-list').appendChild(el);
    }
  }
  
  this.sync = function(fid, action, type) {
    handleSync({
      fid,
      action,
      type,
    });
  };
  
  this.getDescription = function() {
    let data = {};
    for (let desc of $('.description')) {
      if ((['text','hidden','textarea'].includes(desc.type) && desc.value.length === 0) ||
      (desc.type == 'checkbox' && !desc.checked)) continue;
      data[desc.getAttribute('name')] = (desc.type == 'checkbox') ? desc.checked : desc.value;
    }
    
    return JSON.stringify(data);
  };
  
  this.save = function() {
    
    let modifiedTime = new Date().toISOString();
    if (activeFile === undefined) {
      
      let name = getPromptInput('File name', $('.file-name')[activeTab].textContent);
      if (!name) return;
      
      let file = new File({
        name,
      });
      fileManager.sync(file.fid, 'create', 'files');
      drive.syncToDrive();
      fileManager.list();
      fs.save();
      
      closeTab(false);
      newTab(activeTab, {
        fid: file.fid,
        scrollTop: 0,
        row: $('#editor').env.editor.getCursorPosition().row,
        col: $('#editor').env.editor.getCursorPosition().column,
        name: file.name,
        content: file.content,
        fiber: 'close',
        file: file,
        undo: new ace.UndoManager()
      });
    } else {
      
      activeFile.content = $('#editor').env.editor.getValue();
      activeFile.modifiedTime = modifiedTime;
      activeFile.description = fileManager.getDescription();
      handleSync({
        fid: activeFile.fid,
        action: 'update',
        metadata: ['media', 'description'],
        type: 'files'
      });
      drive.syncToDrive();
      fs.save();
      
      $('.icon-rename')[activeTab].textContent = 'close';
      $('#editor').addEventListener('keydown', saveListener);
    }
  };
  
  this.list = function() {
    
    $('#file-list').innerHTML = '';
    
    listFolders();
    listFiles();
    loadBreadCrumbs();
    
    $('#btn-rename-folder').classList.toggle('w3-hide', true);
    selectedFile.splice(0, 1);
  };
  
  this.open = function(fid) {
    
    let f = odin.dataOf(fid, fs.data.files, 'fid');
    activeFile = f;
    
    Promise.all([
      
      (function() {
        
        return new Promise(function(resolve, reject) {
          
          if (f.loaded) {
            resolve(f);
          } else {
            
            aww.pop('Downloading file...');
            
            new Promise(function(resolveTokenRequest) {
          
              if (auth0.state(5))
                return resolveTokenRequest();
              else {
                auth0.requestToken(function() {
                  return resolveTokenRequest();
                }, true);
              }
              
            }).then(function() {
            
              
              fetch('https://www.googleapis.com/drive/v3/files/' + f.id + '?alt=media', {
                method: 'GET',
                headers: {
                  'Authorization': 'Bearer ' + auth0.auth.data.token
                }
              }).then(function(r) {
                
                if (r.ok)
                  return r.text();
                else
                  throw r;
                
              }).then(function(media) {
                
                f.content = media;
                f.loaded = true;
                fs.save();
                resolve(f);
                
              }).catch(reject);
            });
          }
          
        });
      })()
    ]).then(function(file) {
      
      if (fileTab.length == 1 && $('#editor').env.editor.getSession().getValue().length == 0 && String(fileTab[0].fid)[0] == '-')
        closeTab(false);
  
      
      let idx = odin.idxOf(f.fid, fileTab, 'fid')
      if (idx < 0) {
        
        newTab(fileTab.length, {
          fid: f.fid,
          scrollTop: 0,
          row: 0,
          col: 0,
          content: f.content,
          name: f.name,
          fiber: 'close',
          file: f,
          undo: new ace.UndoManager()
        });
      } else
        focusTab(f.fid, false);
      
      
      if ($('#btn-menu-my-files').classList.contains('active'))
        $('#btn-menu-my-files').click();
  
    	if (file[0].description.startsWith('{'))
        openDevelopmentSettings(JSON.parse(file[0].description));
      else
        openDevelopmentSettings(parseDescriptionOld(file[0].description));
    	
    }).catch(function(error) {
      L(error);
      aww.pop('Could not download file');
    });
  };
}


function handleSync(sync) {
  
  if (sync.action === 'create' || sync.action === 'copy') {
    sync.metadata = [];
    fs.data.sync.push(sync);
  } else if (sync.action === 'update') {
      fs.data.sync.push(sync);
    
      for (let i=0; i<fs.data.sync.length-1; i++) {
          let s = fs.data.sync[i];
          
          if (s.fid === sync.fid && s.type == sync.type) {
              if (s.action === 'create' || s.action === 'copy') {
                
                if (!sync.metadata.includes('trashed')) {
                  fs.data.sync.splice(i, 1);
                  sync.action = s.action;
                  sync.metadata = [];
                }
                
              } else {
                
                for (let meta of s.metadata) {
                  if (sync.metadata.indexOf(meta) < 0)
                    sync.metadata.push(meta);
                    
                  if (meta === 'parents')
                    sync.source = s.source;
                }
                
                fs.data.sync.splice(i, 1);
              }
              break;
          }
      }
      
  } else if (sync.action === 'delete') {
    for (let i=0; i<fs.data.sync.length; i++) {
      if (fs.data.sync[i].fid === sync.fid)
        fs.data.sync.splice(i, 1);
    }
  }
}


function fileRename(fid) {
  
  let file = odin.dataOf(fid, fs.data.files, 'fid');
  
  let input = getPromptInput('Rename :', file.name);
  if (!input) return;

  handleSync({
    fid,
    action: 'update',
    metadata: ['name'],
    type: 'files'
  });
  drive.syncToDrive();
  
  fs.save();
  fileList();
  
  if (activeFile) {
    if (fid === activeFile.fid)
      setEditorMode(file.name);
    
    let index = 0
    for (let tab of fileTab) {
      if (tab.fid == fid) {
        $('.file-name')[index].textContent = file.name;
        break;
      }
      index++;
    }
  }
}

function fileList() {
  
  var el;
  $('#file-list').innerHTML = '';
  
  let folders = odin.filterData(activeFolder, fs.data.folders, 'parentId');
  
  folders.sort(function(a, b) {
    return (a.name.toLowerCase() < b.name.toLowerCase()) ? -1 : 1;
  });

  for (let f of folders) {
    if (f.trashed) continue;
    
    el = o.cel('div',{innerHTML:o.creps('tmp-folder-list',f)});
    $('#file-list').appendChild(el);
  }
  
  $('#file-list').appendChild(o.cel('div', {style:'flex:0 0 100%;height:16px;'}));
  
  let files = odin.filterData(activeFolder, fs.data.files, 'parentId');
  
  files.sort(function(a, b) {
    return (a.name.toLowerCase() < b.name.toLowerCase()) ? -1 : 1;
  });
  
  for (let {fid, name, trashed} of files) {
    if (trashed) continue;
    
    let clsLock = '';
    let defaultBg = '#777';
    
    defaultBg = getFileColor(name);
      
    if (fid === locked)
      clsLock = 'w3-text-purple';
    
    el = o.cel('div',{ innerHTML: o.creps('tmp-file-list', {
      fid,
      name,
      defaultBg,
      clsLock
    }) });
    
    $('#file-list').appendChild(el);
  }
  
  loadBreadCrumbs();
  $('#btn-rename-folder').classList.toggle('w3-hide', true);
  selectedFile.splice(0, 1);
}

function getFileAtPath(path, parentId = -1) {
    
  while (path.match('//'))
    path = path.replace('//','/');
  
  let dir = path.split('/');
  let folder;
  
  while (dir.length > 1) {
    
    if (dir[0] === '..' || dir[0] === '.'  || dir[0] === '') {
      
      folder = odin.dataOf(parentId, fs.data.folders, 'fid');
      if (folder === undefined)
        break;
      dir.splice(0, 1);
      parentId = folder.parentId;
    } else {
      
      let folders = odin.filterData(parentId, fs.data.folders, 'parentId');
      folder = odin.dataOf(dir[0], folders, 'name');
      if (folder) {
        parentId = folder.fid;
        dir.splice(0, 1);
      } else {
        parentId = -2;
        break;
      }
    }
  }
  
  let fileName = path.replace(/.+\//g,'')
  let files = odin.filterData(parentId, fs.data.files, 'parentId');
  let found = files.find(file => file.name == fileName);
  return found;
}

function openFile(fid) {
  
  let f = odin.dataOf(fid, fs.data.files, 'fid');
  activeFile = f;
  
  Promise.all([
    
    (function() {
      
      return new Promise(function(resolve, reject) {
        
        if (f.loaded) {
          resolve(f)
        } else {
          
          aww.pop('Downloading file...');
          
          new Promise(function(resolveTokenRequest) {
        
            if (auth0.state(5))
              return resolveTokenRequest();
            else {
              auth0.requestToken(function() {
                return resolveTokenRequest();
              }, true);
            }
            
          }).then(function() {
          
            
            fetch('https://www.googleapis.com/drive/v3/files/' + f.id + '?alt=media', {
              method: 'GET',
              headers: {
                'Authorization': 'Bearer ' + auth0.auth.data.token
              }
            }).then(function(r) {
              
              if (r.ok)
                return r.text();
              else
                throw r;
              
            }).then(function(media) {
              
              f.content = media;
              f.loaded = true;
              fs.save();
              resolve(f);
              
            }).catch(reject)
          })
        }
        
      });
    })()
  ]).then(function(file) {
    
    if (fileTab.length == 1 && $('#editor').env.editor.getSession().getValue().length == 0 && String(fileTab[0].fid)[0] == '-')
      closeTab(false);

    
    let idx = odin.idxOf(f.fid, fileTab, 'fid')
    
    if (idx < 0) {
      
      newTab(fileTab.length, {
        fid: f.fid,
        scrollTop: 0,
        row: 0,
        col: 0,
        content: f.content,
        name: f.name,
        fiber: 'close',
        file: f,
        undo: new ace.UndoManager()
      });
    } else {
      fileTab[activeTab].content = $('#editor').env.editor.getSession().getValue();
      focusTab(f.fid, false);
    }
    
    if ($('#btn-menu-my-files').classList.contains('active'))
      $('#btn-menu-my-files').click();

  	if (file[0].description.startsWith('{'))
      openDevelopmentSettings(JSON.parse(file[0].description));
    else
      openDevelopmentSettings(parseDescriptionOld(file[0].description));
  	
  }).catch(function(error) {
    
    L(error);
    aww.pop('Could not download file');
  })
}

function fileClose(fid) {
  
  let idx;
  
  if (fid)
    idx = odin.idxOf(String(fid), fileTab, 'fid')
  else
    idx = activeTab
  
  if (activeTab == idx) {
    
    activeTab = idx
    closeTab()
  } else {
    
    let tmp = activeTab;
    activeTab = idx;
    
    if (idx < tmp)
      closeTab(true, tmp-1)
    else
      closeTab(true, tmp)
  }
  
}

function fixOldParse(ob) {
  if (ob.bibibi)
    ob.isSummaryFix = true;
  if (ob.pre)
    ob.isWrap = true;
  if (ob.more)
    ob.isBreak = true;
  if (ob.blog)
    ob.blogName = ob.blog;
  if (ob.eid)
    ob.entryId = ob.eid;
}

function parseDescriptionOld(txt) {
  
  let obj = {};
  txt = txt.split('\n');
  
	for (let i = 0; i < txt.length; i++) {
	  
	  let t = txt[i];
	  t = t.trim();
	  if (t.length === 0) {
	    
      txt.splice(i, 1);
      i -= 1;
      continue;
    }
    
    let key = t.split(':')[0];
    let val = t.split(key+': ')[1];
    
    if (val === "false")
      val = false;
    else if (val === "true")
      val = true;
    else if (val == undefined)
      val = "";
      
    obj[key] = val;
	}
	
	fixOldParse(obj);
	
  return obj;
}


(function() {

  function getAppScript(blogId, entryId) {
    return '<script>' + $('#arc7-updater').textContent.replace('<blogId>', blogId).replace('<appId>', entryId) + '</script>';
  }

  function getBlogId(file, blogName) {
    aww.pop('Retrieving blog id ...');
    oblog.config({ blog: blogName});
    oblog.getBlogId(blogId => {
      let settings = file.description.startsWith('{') ? JSON.parse(file.description) : parseDescriptionOld(file.description);
      settings.blogId = blogId;
      file.description = JSON.stringify(settings);
      if (locked < 0)
        $('#in-blog-id').value = blogId;
      fileManager.save();
      deploy();
    });
  }
  
  function wrapInPre(HTML) {
    HTML = HTML.replace(/<\/pre>/g,'</xpre>');
    let match = HTML.match(/<pre.*?>/g);
    if (match) {
      for (let pre of match)
        HTML = HTML.replace(pre, pre.replace('<pre', '<xpre'));
    }
    return '<pre>' + HTML + '</pre>';
  }

  function deploy() {
    
    let data = (locked >= 0) ? odin.dataOf(locked, fs.data.files, 'fid') : activeFile;
    let {blogName, blogId, entryId, summary = '', isBreak, isApp, isWrap, isSummaryFix} = data.description.startsWith('{') ? JSON.parse(data.description) : parseDescriptionOld(data.description);

    if (blogName && entryId) {
      
      if (isApp && !blogId) {
        getBlogId(data, blogName);
        return;
      }
      
      aww.pop('Deploying update...');
      
      let more = isBreak ? '<!--more--> ' : '';
      let summaryFix = isSummaryFix ? 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' : '';
      let content = uploadBody;
      
      if (isApp)
        content = getAppScript(blogId, entryId) + content;
      if (isWrap)
        content = wrapInPre(content);

      content = summary + more + summaryFix + content;
      
      if (entryId.startsWith('p')) {
        
        oblog.config({ blog: blogName });
        oblog.pages.patch(entryId.substring(1), {
          content
        }, e => {
          
          if (e == 404)
            aww.pop('404')
          else {
            aww.pop('Update Deployed!')
          }
        })
      } else {
        
        oblog.config({ blog: blogName });
        oblog.posts.patch(entryId, {
          content
        }, e => {
          
          if (e == 404)
            aww.pop('404')
          else if (e == 400)
            aww.pop('400')
          else
            aww.pop('Update Deployed!')
        })
      }
    } else
      alert('Deploy failed. Blog name or entry ID has not been set.');
  }
  
  window.deploy = deploy;
  
})();


function openFolder(folderId) {
  activeFolder = folderId;
  
  if (activeFolder == -1) {
    breadcrumbs.splice(1);
  } else {
    let folder = odin.dataOf(folderId, fs.data.folders, 'fid');
    title = folder.name;
    breadcrumbs.push({folderId:activeFolder, title: title})
  }
  
  fileList();
}


(function() {
  
  function getBranch(parents) {
    let files = []
    let folders = []
    
    for (let p of parents) {
      let f = odin.filterData(p.fid, fs.data.files, 'parentId');
      let f2 = odin.filterData(p.fid, fs.data.folders, 'parentId');
      
      for (let i of f)
        files.push(i)
      for (let i of f2)
        folders.push(i)
        
      let data = getBranch(f2);
      
      for (let i of data.files)
        files.push(i)
      for (let i of data.folders)
        folders.push(i)
    }
    
    return {files: files, folders: folders};
  }
  
  function getAllBranch(fid) {
    let files = [];
    let folders = odin.filterData(fid, fs.data.folders, 'fid')
    
    let data = getBranch(folders);
    
    for (let f of data.files)
      files.push(f)
    for (let f of data.folders)
      folders.push(f)
      
    let fileIds = [];
    let folderIds = [];
    for (let f of files)
      fileIds.push(f.fid)
    for (let f of folders)
      folderIds.push(f.fid)
      
    return {fileIds: fileIds, folderIds: folderIds}
  }
  
  window.getAllBranch = getAllBranch;
  
})();



function fileDownload() {
  
  let name = activeFile ? activeFile.name : $('.file-name',$('.file-tab')[activeTab])[0].textContent+'.html';
  let chunks = activeFile ? activeFile.content : $('#editor').env.editor.getValue();

  if (name === 'null' || !name)
    return;
  
  let blob = new Blob([chunks], {type: 'application/octet-stream'});
  let url = URL.createObjectURL(blob);
  let a = o.cel('a', {
    href: url,
    download: name
  })
  $('#limbo-element').appendChild(a);
  a.click();
  $('#limbo-element').removeChild(a);
}


(function() {
  
  let copyParentFolderId = -2;
  
  function copyFile(cut) {
    
    for (let f of selectedFile) {
      if (clipBoard.indexOf(f) < 0)
        clipBoard.push(f);
    }
    
    copyParentFolderId = activeFolder;
    pasteFile.mode = cut ? 'cut' : 'copy';
  }
  window.copyFile = copyFile;
  
  function copySingleFile({ id, fid, description, name, content, loaded }, modifiedTime) {
    let action = (loaded) ? 'create' : 'copy';
    let file = new File({
      id,
      name: (copyParentFolderId == activeFolder) ? name + ' (copy)' : name,
      modifiedTime,
      content,
      description,
      loaded,
      parentId: activeFolder,
    }, action, false, false);
    fileManager.sync(file.fid, action, 'files');
  }
  
  function copyBranchFile(fileIds, road, modifiedTime) {
    
    if (fileIds.length === 0) return;
    
    ({ id, fid, name, description, parentId, content, loaded, trashed } = odin.dataOf(fileIds[0], fs.data.files, 'fid'));
    
    if (!trashed) {
      let idx = odin.idxOf(parentId, road, 0);
      let action = (loaded) ? 'create' : 'copy';
      let file = new File({
        id,
        name,
        description,
        modifiedTime,
        trashed,
        content,
        loaded,
        parentId: road[idx][1],
      }, action, false, false);
      fileManager.sync(file.fid, action, 'files');
    }
    fileIds.splice(0, 1);
    copyBranchFile(fileIds, road, modifiedTime);
  }
  
  function copyBranchFolder(folderIds, modifiedTime, road = []) {
  
    if (folderIds.length === 0) return road;
    
    let folderId = folderIds[0];
    
    ({ name, modifiedTime, parentId, trashed } = odin.dataOf(folderId, fs.data.folders, 'fid'));
    
    if (!trashed) {
      road.push([folderId, fs.data.counter.folders]);
      
      let idx = odin.idxOf(parentId, road, 0);
      
      if (copyParentFolderId == activeFolder) {
        name = name + ' (copy)';
        copyParentFolderId = -2;
      }
      
      let folder = new Folder({
        name,
        modifiedTime,
        parentId: (idx < 0) ? activeFolder : road[idx][1],
      })
      fileManager.sync(folder.fid, 'create', 'folders');
    }
    
    folderIds.splice(0, 1);
  
    return copyBranchFolder(folderIds, modifiedTime, road);
    
  }
  
  function fileMove(data, fileType) {
  
    handleSync({
      fid: data.fid,
      action: 'update',
      metadata: ['parents'],
      type: fileType,
      source: data.parentId
    });
    
    data.parentId = activeFolder;
  }
  
  function pasteFile() {
    
    if (clipBoard.length === 0) return;
    
    while (clipBoard.length > 0) {
      let data;
      let fid = clipBoard[0].getAttribute('data');
      let type = clipBoard[0].getAttribute('data-type');
      let modifiedTime = new Date().toISOString();
      
      if (type === 'file') {
        data = odin.dataOf(fid, fs.data.files, 'fid');
        if (pasteFile.mode === 'copy')
          copySingleFile(data, modifiedTime);
        else {
          if (data.parentId !== activeFolder)
            fileMove(data, 'files');
        }
      } else {
        if (pasteFile.mode === 'copy') {
          let branch = getAllBranch(fid);
       
          let road = copyBranchFolder(branch.folderIds, modifiedTime);
          copyBranchFile(branch.fileIds, road, modifiedTime);
        } else {
          data = odin.dataOf(fid, fs.data.folders, 'fid');
          if (data.parentId !== activeFolder)
            fileMove(data, 'folders');
        }
      }
      
      clipBoard.splice(0, 1);
      selectedFile.splice(0, 1);
    }
    
    drive.syncToDrive();
    fs.save();
    fileList();
    
    copyParentFolderId = -2;
  }
  pasteFile.mode = 'copy';
  
  window.pasteFile = pasteFile;
  
})();



function trashList() {
  
  var el;
  $('#list-trash').innerHTML = '';
  
  let folders = odin.filterData(true, fs.data.folders, 'trashed');
  
  folders.sort(function(a, b) {
    return (a.name.toLowerCase() < b.name.toLowerCase()) ? -1 : 1;
  });

  for (let f of folders) {
    el = o.cel('div',{innerHTML:o.creps('tmp-list-folder-trash', f)});
    $('#list-trash').appendChild(el);
  }
  
  $('#list-trash').appendChild(o.cel('div', {style:'flex:0 0 100%;height:16px;'}));
  
  let files = odin.filterData(true, fs.data.files, 'trashed');
  
  files.sort(function(a, b) {
    return (a.name.toLowerCase() < b.name.toLowerCase()) ? -1 : 1;
  });
  
  for (let {fid, name, trashed} of files) {
    let clsLock = '';
    let defaultBg = '#777';
    
    defaultBg = getFileColor(name);
      
    if (fid === locked)
      clsLock = 'w3-text-purple';
    
    el = o.cel('div',{ innerHTML: o.creps('tmp-list-file-trash', {
      fid,
      name,
      defaultBg,
      clsLock
    }) });
    
    $('#list-trash').appendChild(el);
  }
}