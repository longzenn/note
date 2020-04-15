let activeFile;
let activeFolder = -1;

let lastClickEl;
let selectedFile = [];
let clipBoard = [];
let doubleClick = false;

let fileTab = [];
let activeTab = 0;

let breadcrumbs = [{folderId:'-1',title:'My Files'}];


(function() {
  
  function File(data = {}) {
    
    let file = fs.new('files');
    
    let predefinedData = {
      fid: fs.data.counter.files,
      name: 'Untitled File',
      description: "{}",
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
    
    fs.save();
    this.sync(file.fid);
    fileManager.list();
    
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
    this.sync(file.fid);
    fileManager.list();
    
    return file;
  }
  
  File.prototype.sync = function(fid) {
    handleSync({
      fid,
      action: 'create',
      type: 'files'
    });
    drive.syncToDrive();
  };
  
  Folder.prototype.sync = function(fid) {
    handleSync({
      fid,
      action: 'create',
      type: 'folders'
    });
    drive.syncToDrive();
  };
  
  window.File = File;
  window.Folder = Folder;
  
})();


(function() {
  
  function FileManager() {
    return this;
  }
  
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
    $('#file-list').appendChild(o.cel('div', { class: 'w3-row w3-padding-small' }));
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
  
  FileManager.prototype.list = function() {
    
    $('#file-list').innerHTML = '';
    
    listFolders();
    listFiles();
    loadBreadCrumbs();
    
    $('#btn-rename-folder').classList.toggle('w3-hide', true);
    selectedFile.splice(0, 1);
  };
  
  
  // function openFile(fid) {
  FileManager.prototype.open = function(fid) {
    
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
      } else
        focusTab(f.fid, false);
      
      
      if ($('#btn-menu-my-files').classList.contains('active'))
        $('#btn-menu-my-files').click();
  
      if (f.name.endsWith('.blogger'))
        $('#btn-blog-vc').classList.toggle('w3-hide', false);
      else
        $('#btn-blog-vc').classList.toggle('w3-hide', true);
    	
    	if (file[0].description.startsWith('{'))
        openDevelopmentSettings(JSON.parse(file[0].description));
      else
        openDevelopmentSettings(parseDescriptionOld(file[0].description));
    	
    }).catch(function(error) {
      L(error);
      aww.pop('Could not download file');
    });
  };
  
  
  window.fileManager = new FileManager();
  
})();


const fm = {
  INSERT: {
    folder: function(data) {
      
      let folder = fs.new('folders');
      folder.fid = fs.data.counter.folders;
      
      for (let d in data)
        folder[d] = data[d];

      fs.data.folders.push(folder);
      fs.data.counter.folders++;
      
    },
    file: function(data) {
      
      let file = fs.new('files');
      file.fid = fs.data.counter.files;
      
      for (let d in data)
        file[d] = data[d];

      fs.data.files.push(file);
      fs.data.counter.files++;
      
      return file;
    }
  }
};


function rollbackRevision(id) {
  
  aww.pop('Downloading rollback resource...');
  
  fetch(drive.apiUrl+'files/'+activeFile.id+'/revisions/'+id+'?alt=media', {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer '+auth0.auth.data.token
    }
  }).then(function(response) {
    
    if (response.ok)
      return response.text();
    else
      throw response.status;
  }).then((media) => {
    
    aww.pop('Successfully rollback to selected revision');
    $('#editor').env.editor.setValue(media);
    
  }).catch(() => {
    
    aww.pop('Could not download required file: '+data.name);
    
  });
}

function deleteRevision(id, el) {
  
  if (!window.confirm('Delete selected revision?')) return;
  
   fetch(drive.apiUrl+'files/'+activeFile.id+'/revisions/'+id, {
    method:'DELETE',
    headers: {
      'Authorization':'Bearer '+auth0.auth.data.token
    }
  }).then(function(result) {
    
    return result;
  }).then(function() {
    
    L('empty response body');
    el.parentElement.parentElement.removeChild(el.parentElement);
  });
  
}

function keepRevision() {
  
  aww.pop('please wait...');
  fetch(drive.apiUrl+'files/'+activeFile.id+'?fields=headRevisionId', {
    headers: {
      'Authorization':'Bearer '+auth0.auth.data.token
    }
  }).then(function(r) {
    
    return r.json();
    
  }).then(function(json) {
    
    aww.pop('saving revision...');
    
    fetch(drive.apiUrl+'files/'+activeFile.id+'/revisions/'+json.headRevisionId+'?fileds=id', {
      method: 'PATCH',
      headers: {
        'Authorization':'Bearer '+auth0.auth.data.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        "keepForever": true
      })
    }).then(function(r) {
      
      return r.json();
      
    }).then(function(json) {
      
      aww.pop('Ok');
      
    });
    
  });
  
}

function listRevisions() {
  
  fetch(drive.apiUrl+'files/'+activeFile.id+'/revisions?fields=revisions(id,modifiedTime,keepForever)', {
    method:'GET',
    headers: {
      'Authorization':'Bearer '+auth0.auth.data.token
    }
  }).then(function(result) {
    return result.json();
  }).then(function(json) {
    let keepForever = [];
    
    json.revisions.forEach((rev) => {
      if (rev.keepForever)
        keepForever.push(rev);
    });
    
    $('#list-revisions').innerHTML = o.creps('tmp-list-revision', keepForever);
    
  });
}


function handleSync(sync) {
  
  if (sync.action === 'create' || sync.action === 'copy') {
    sync.metadata = [];
    fs.data.sync.push(sync);
  } else if (sync.action === 'update') {
      fs.data.sync.push(sync);
    
      for (let i=0; i<fs.data.sync.length-1; i++) {
          let s = fs.data.sync[i];
          
          if (s.fid === sync.fid) {
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
  
  let input = window.prompt('Rename :', file.name);
  if (input === null)
    return;
  if (input.trim().length === 0)
    input = file.name;
  else
    file.name = input;
  
  handleSync({
    fid,
    action: 'update',
    metadata: ['name'],
    type: 'files'
  });
  drive.syncToDrive();
  
  fs.save();
  fileList();
  
  // editor
  if (activeFile && fid === activeFile.fid) {
    setEditorMode(file.name);
    $('.file-name')[activeTab].textContent = file.name;
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
  
  $('#file-list').appendChild(o.cel('div', { class: 'w3-row w3-padding-small' }));
  
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



function loadBreadCrumbs() {
  $('#breadcrumbs').innerHTML = '';
  let i = 0;
  for (let b of breadcrumbs) {
    let link;
    if (i == breadcrumbs.length-1)
      link = o.cel('div',{innerHTML:o.creps('tmp-breadcrumb-fake', b),class:'w3-inline-block w3-left breadcrumbs'});
    else
      link = o.cel('div',{innerHTML:o.creps('tmp-breadcrumb', b),class:'w3-inline-block w3-left breadcrumbs'});
    $('#breadcrumbs').appendChild(link);
    i++;
  }
}

function openBread(id) {
  activeFolder = id;
  let idx = odin.idxOf(id,breadcrumbs,'folderId');
  breadcrumbs = breadcrumbs.slice(0,idx+1);
  fileList();
}

function openFolderConfirm(el) {
  if (selectedFile.length < 1)
    selectedFile.push(el);
  
  if (lastClickEl !== undefined && lastClickEl != el) {
    selectedFile.splice(0, 1);
    selectedFile.push(el);
    
    toggleFileHighlight(false);
    doubleClick = false;
  }
  
  if (!doubleClick) {
    $('#btn-rename-folder').classList.toggle('w3-hide', false);
    
    lastClickEl = el;
    doubleClick = true;
    toggleFileHighlight(true);
    setTimeout(function(){
      doubleClick = false;
    }, 500);
  } else {
    $('#btn-rename-folder').classList.toggle('w3-hide', true);
    
    selectedFile.splice(0, 1);
    
    doubleClick = false;
    let folderId = Number(el.getAttribute('data'))
    openFolder(folderId);
    toggleFileHighlight(false);
  }
}

function openFileConfirm(el) {
  if (selectedFile.length < 1)
    selectedFile.push(el);
  
  $('#btn-rename-folder').classList.toggle('w3-hide', true);
  
  if (lastClickEl !== undefined && lastClickEl != el) {
    selectedFile.splice(0, 1);
    selectedFile.push(el);
    
    toggleFileHighlight(false);
    doubleClick = false;
  }
  
  if (!doubleClick) {
    lastClickEl = el;
    doubleClick = true;
    toggleFileHighlight(true);
    setTimeout(function(){
      doubleClick = false;
    },500)
  } else {
    selectedFile.splice(0, 1);
    doubleClick = false;
    openFile(el.getAttribute('data'));
    toggleFileHighlight(false);
  }
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

    if (f.name.endsWith('.blogger'))
      $('#btn-blog-vc').classList.toggle('w3-hide', false);
    else
      $('#btn-blog-vc').classList.toggle('w3-hide', true);
  	
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

(function() {
  
  function getDeploySetting() {
    let data = {};
    for (let desc of $('.description')) {
      if ((['text','hidden','textarea'].includes(desc.type) && desc.value.length === 0) ||
      (desc.type == 'checkbox' && !desc.checked)) continue;
      data[desc.getAttribute('name')] = (desc.type == 'checkbox') ? desc.checked : desc.value;
    }
    
    return JSON.stringify(data);
  }
  
  function fileSave() {
    
    let modifiedTime = new Date().toISOString();
    if (activeFile === undefined)
      ui.fm.newFile();
    else {
      
      activeFile.content = $('#editor').env.editor.getValue();
      activeFile.modifiedTime = modifiedTime;
      activeFile.description = getDeploySetting();
      handleSync({
        fid: activeFile.fid,
        action: 'update',
        metadata: ['media', 'description'],
        type: 'files'
      })
      drive.syncToDrive();
      fs.save();
      
      $('.icon-rename')[activeTab].textContent = 'close';
      $('#editor').addEventListener('keydown', saveListener);
    }
  }
  
  window.getDeploySetting = getDeploySetting;
  window.fileSave = fileSave;
  
})();

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
      fileSave();
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
    
    fm.INSERT.file({
      id,
      name: (copyParentFolderId == activeFolder) ? name + ' (copy)' : name,
      modifiedTime,
      content,
      description,
      loaded,
      parentId: activeFolder,
    });
    
    handleSync({
      fid: fs.data.counter.files-1,
      action: (loaded) ? 'create' : 'copy',
      type: 'files'
    })
  }
  
  function copyBranchFile(fileIds, road, modifiedTime) {
    
    if (fileIds.length === 0) return;
    
    ({ id, fid, name, description, parentId, content, loaded, trashed } = odin.dataOf(fileIds[0], fs.data.files, 'fid'));
    
    if (!trashed) {
      let idx = odin.idxOf(parentId, road, 0);
      
      fm.INSERT.file({
        id,
        name,
        description,
        modifiedTime,
        trashed,
        content,
        loaded,
        parentId: road[idx][1],
      });
      
      handleSync({
        fid: fs.data.counter.files-1,
        action: (loaded) ? 'create' : 'copy',
        type: 'files'
      })
      
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
      
      fm.INSERT.folder({
        name,
        modifiedTime,
        parentId: (idx < 0) ? activeFolder : road[idx][1],
      });
      
      handleSync({
        action: 'create',
        fid: fs.data.counter.folders-1,
        type: 'folders'
      })
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
    
    while (clipBoard.length > 0)
    {
      let data;
      let fid = clipBoard[0].getAttribute('data');
      let type = clipBoard[0].getAttribute('data-type');
      let modifiedTime = new Date().toISOString();
      
      if (type === 'file')
      {
        data = odin.dataOf(fid, fs.data.files, 'fid');
        
        if (pasteFile.mode === 'copy')
          copySingleFile(data, modifiedTime);
        else
        {
          if (data.parentId !== activeFolder)
            fileMove(data, 'files');
        }
      }
      else
      {
        if (pasteFile.mode === 'copy')
        {
          let branch = getAllBranch(fid);
       
          let road = copyBranchFolder(branch.folderIds, modifiedTime);
          copyBranchFile(branch.fileIds, road, modifiedTime);
        }
        else
        {
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
  
  $('#list-trash').appendChild(o.cel('div', { class: 'w3-row w3-padding-small' }));
  
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