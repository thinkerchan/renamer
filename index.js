import fs from 'fs-extra';
import path from 'path';
import glob from 'fast-glob';
import exifr from 'exifr';

async function getExifCreationDate(filePath) {
  try {
    const exif = await exifr.parse(filePath);

    if (exif && exif.DateTimeOriginal) {
      return new Date(exif.DateTimeOriginal);
    }

    return null;
  } catch (error) {
    console.warn(`无法读取EXIF信息: ${error.message}`);
    return null;
  }
}

const supportedExtensions = {
  IMG: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'tiff', 'tif', 'bmp', 'raw', 'arw', 'cr2', 'nef'],
  VIDEO: ['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', '3gp', 'webm'],
  AUDIO: ['mp3', 'wav', 'aac', 'ogg', 'm4a', 'wma']
};

const CONFIG = {
  overwrite: false
};

const CACHE_FILE = 'renamer_history.txt';

const flattenedExtensions = Object.values(supportedExtensions).flat();

// 文件操作相关的工具函数
const FileUtils = {
  async checkAndMove(sourcePath, targetPath) {
    if (await fs.pathExists(targetPath)) {
      throw Object.assign(new Error('目标文件已存在'), { code: 'EEXIST' });
    }
    await fs.move(sourcePath, targetPath, CONFIG);
    // 记录重命名记录到历史文件
    await this.saveToCache(sourcePath, targetPath);
  },

  async validatePath(path) {
    if (!path) {
      throw new Error('路径不能为空');
    }
    return await fs.stat(path);
  },

  isMediaFile(ext) {
    if (!ext) return false;
    return flattenedExtensions.includes(ext.slice(1).toLowerCase());
  },

  async saveToCache(oldPath, newPath) {
    const cacheEntry = `${oldPath}|${newPath}\n`;
    await fs.appendFile(CACHE_FILE, cacheEntry, 'utf8');
  },

  async loadCache() {
    try {
      if (await fs.pathExists(CACHE_FILE)) {
        const content = await fs.readFile(CACHE_FILE, 'utf8');
        return content.split('\n')
          .filter(line => line.trim())
          .map(line => {
            const [oldPath, newPath] = line.split('|');
            return { oldPath, newPath };
          });
      }
      return [];
    } catch (error) {
      console.error('读取历史文件失败:', error);
      return [];
    }
  }
};

// 日期处理相关的工具函数
const DateUtils = {
  formatDateTime(date) {
    if (!(date instanceof Date) || isNaN(date)) {
      throw new Error('无效的日期');
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 4);
    return `${year}${month}${day}_${hours}${minutes}${seconds}_${random}`;
  },

  formatWxDateTime(date) {
    return date.toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '_')
      .slice(0, 15);
  }
};

async function extractExifDate(filePath, useExif = false) {
  if (!filePath) {
    throw new Error('文件路径不能为空');
  }

  if (useExif) {
    const ext = path.extname(filePath).toLowerCase();
    if (supportedExtensions.IMG.includes(ext.slice(1))) {
      const exifDate = await getExifCreationDate(filePath);
      if (exifDate) {
        return { time: exifDate, ext };
      }
    }
  }

  try {
    const stats = await fs.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    return {
      time: stats.birthtime.getTime() === 0 ? stats.mtime : stats.birthtime,
      ext
    };
  } catch (error) {
    throw new Error(`无法获取文件创建时间: ${error.message}`);
  }
}

async function renameMedia(targetPath, usePrefix = '', useExif = false) {
  try {
    const stats = await FileUtils.validatePath(targetPath);

    if (stats.isFile()) {
      const ext = path.extname(targetPath);
      if (FileUtils.isMediaFile(ext)) {
        await renameSingleFile(targetPath, usePrefix, useExif);
      } else {
        console.warn(`跳过非媒体文件: ${targetPath}`);
      }
    } else if (stats.isDirectory()) {
      await renameDirectory(targetPath, usePrefix, useExif);
    } else {
      throw new Error(`无效的路径: ${targetPath}`);
    }
  } catch (error) {
    throw new Error(`处理路径失败: ${error.message}`);
  }
}

async function renameSingleFile(filePath, usePrefix = '', useExif = false) {
  await FileUtils.validatePath(filePath);
  const dir = path.dirname(filePath);

  try {
    const { time, ext } = await extractExifDate(filePath, useExif);
    const dateString = DateUtils.formatDateTime(time);
    const extLower = ext.toLowerCase();

    const defaultPrefix = Object.keys(supportedExtensions).find(key =>
      supportedExtensions[key].includes(extLower.slice(1))
    );
    if (!defaultPrefix) {
      throw new Error(`不支持的文件类型: ${ext}`);
    }

    const finalPrefix = usePrefix || defaultPrefix;
    const newFileName = `${finalPrefix}_${dateString}${extLower}`;
    const newFilePath = path.join(dir, newFileName);

    if (filePath === newFilePath) {
      console.log(`⏭️ 跳过: ${filePath} , 已存在相同文件名`);
      return;
    }

    await FileUtils.checkAndMove(filePath, newFilePath);
    console.log(`✅ 重命名成功: ${path.basename(filePath)} -> ${newFileName}`);

  } catch (error) {
    if (error.code === 'EEXIST') {
      console.error(`❌ 文件 ${filePath} 重命名失败: 目标文件已存在`);
    } else {
      console.error(`❌ 处理 ${filePath} 时出错: ${error.message}`);
    }
    throw error;
  }
}

async function renameDirectory(directory, usePrefix = '', useExif = false) {
  await FileUtils.validatePath(directory);

  try {
    const files = await glob(`*.{${flattenedExtensions.join(',')}}`, {
      cwd: directory,
      caseSensitiveMatch: false,
      absolute: true
    });

    const results = await Promise.allSettled(
      files.map(file => renameSingleFile(file, usePrefix, useExif))
    );

    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length > 0) {
      console.error(`有 ${failures.length} 个文件处理失败`);
      failures.forEach(failure => {
        console.error(`失败原因: ${failure.reason.message}`);
      });
    }
  } catch (error) {
    throw new Error(`处理目录失败: ${error.message}`);
  }
}

async function renameWxFile(directory) {
  await FileUtils.validatePath(directory);

  const wxFilePattern = /^mmexport(\d+)\./i;
  const results = [];

  try {
    const files = await fs.readdir(directory);

    for (const file of files) {
      const match = file.match(wxFilePattern);
      if (!match) continue;

      const filePath = path.join(directory, file);
      const timestamp = parseInt(match[1]);

      if (isNaN(timestamp)) {
        console.warn(`无效的时间戳: ${file}`);
        continue;
      }

      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        console.warn(`无效的日期: ${file}`);
        continue;
      }

      const dateString = DateUtils.formatWxDateTime(date);
      const random = Math.random().toString(36).substring(2, 4);
      const ext = path.extname(file);
      const newFileName = `mmexport_${dateString}_${random}${ext}`;
      const newFilePath = path.join(directory, newFileName);

      try {
        await FileUtils.checkAndMove(filePath, newFilePath);
        console.log(`✅ 重命名成功: ${file} -> ${newFileName}`);
        results.push({success: true, file, newName: newFileName});
      } catch (error) {
        if (error.code === 'EEXIST') {
          console.error(`❌ 文件 ${file} 重命名失败: 目标文件已存在`);
        } else {
          console.error(`❌ 处理 ${file} 时出错: ${error.message}`);
        }
        results.push({success: false, file, error: error.message});
      }
    }

    return results;
  } catch (error) {
    throw new Error(`处理目录失败: ${error.message}`);
  }
}

async function resetAllFiles() {
  try {
    const cacheEntries = await FileUtils.loadCache();
    if (cacheEntries.length === 0) {
      console.log('没有找到历史记录，无法恢复文件名');
      return;
    }

    const successfullyRestored = [];

    for (const entry of cacheEntries) {
      try {
        if (await fs.pathExists(entry.newPath)) {
          await fs.move(entry.newPath, entry.oldPath, { overwrite: true });
          console.log(`✅ 已恢复文件名: ${path.basename(entry.newPath)} -> ${path.basename(entry.oldPath)}`);
          successfullyRestored.push(entry);
        } else {
          console.warn(`⚠️ 文件不存在，无法恢复: ${entry.newPath}`);
        }
      } catch (error) {
        console.error(`❌ 恢复文件名失败: ${entry.newPath}`, error);
      }
    }

    // 从历史中移除已成功恢复的条目
    const remainingEntries = cacheEntries.filter(entry =>
      !successfullyRestored.some(restored =>
        restored.oldPath === entry.oldPath && restored.newPath === entry.newPath
      )
    );

    // 更新历史文件
    await fs.writeFile(CACHE_FILE, remainingEntries.map(entry =>
      `${entry.oldPath}|${entry.newPath}`
    ).join('\n'));

    console.log('✅ 所有文件恢复完成');
  } catch (error) {
    throw new Error(`恢复文件名失败: ${error.message}`);
  }
}

export { renameMedia, renameWxFile, resetAllFiles };