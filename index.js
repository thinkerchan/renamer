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

const flattenedExtensions = Object.values(supportedExtensions).flat();

async function extractExifDate(filePath, useExif = false) {
  if (useExif) {
    const exifDate = await getExifCreationDate(filePath);
    if (exifDate) {
      return { time: exifDate, ext: path.extname(filePath).toLowerCase() };
    }
  }

  try {
    const stats = await fs.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    return {
      time: stats.birthtime,
      ext
    };
  } catch (error) {
    throw new Error(`无法获取文件创建时间: ${error.message}`);
  }
}

function formatDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 4);
  return `${year}${month}${day}_${hours}${minutes}${seconds}_${random}`;
}

async function renameMedia(targetPath, usePrefix = '', useExif = false) {
  if (!targetPath) {
    throw new Error('请提供有效的目标路径');
  }

  const stats = await fs.stat(targetPath);

  if (stats.isFile()) {
    const { ext } = await extractExifDate(targetPath, useExif);
    if (isMediaFile(ext)) {
      await renameSingleFile(targetPath, usePrefix, useExif);
    } else {
      console.warn(`跳过非媒体文件: ${targetPath}`);
    }
  } else if (stats.isDirectory()) {
    await renameDirectory(targetPath, usePrefix, useExif);
  } else {
    throw new Error(`无效的路径: ${targetPath}`);
  }
}

async function renameSingleFile(filePath, usePrefix = '', useExif = false) {
  if (!filePath) {
    throw new Error('请提供有效的文件路径');
  }

  const dir = path.dirname(filePath);

  try {
    const { time, ext } = await extractExifDate(filePath, useExif);
    const dateString = formatDateTime(time);
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

    if (await fs.pathExists(newFilePath)) {
      let version = 1;
      let versionedFilePath;

      do {
        const versionedFileName = `${finalPrefix}_${dateString}_${version}${extLower}`;
        versionedFilePath = path.join(dir, versionedFileName);
        version++;
      } while (await fs.pathExists(versionedFilePath));

      await fs.move(filePath, versionedFilePath);
      console.log(`✅ 重命名成功(添加版本号): ${path.basename(filePath)} -> ${path.basename(versionedFilePath)}`);
      return;
    }

    await fs.move(filePath, newFilePath);
    console.log(`✅ 重命名成功: ${path.basename(filePath)} -> ${newFileName}`);

  } catch (error) {
    console.error(`❌ 处理 ${filePath} 时出错: ${error.message}`);
    throw error;
  }
}

async function renameDirectory(directory, usePrefix = '', useExif = false) {
  if (!directory) {
    throw new Error('请提供有效的目录路径');
  }

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
  }
}

function isMediaFile(ext) {
  return flattenedExtensions.includes(ext.slice(1).toLowerCase());
}

async function renameWxFile(directory) {
  // 处理微信导出的媒体文件，将时间戳转换为日期格式
  const wxFilePattern = /^mmexport(\d+)\./i;

  if (!directory) {
    throw new Error('请提供有效的目录路径');
  }

  const files = await fs.readdir(directory);
  const results = [];

  for (const file of files) {
    const match = file.match(wxFilePattern);
    if (!match) continue;

    const filePath = path.join(directory, file);
    const timestamp = parseInt(match[1]);
    const date = new Date(timestamp);

    // 格式化日期为 YYYYMMDD_HHMMSS
    const dateString = date.toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '_')
      .slice(0, 15);

    const ext = path.extname(file);
    const newFileName = `mmexport_${dateString}${ext}`;
    const newFilePath = path.join(directory, newFileName);

    try {
      if (await fs.pathExists(newFilePath)) {
        let version = 1;
        let versionedFilePath;

        do {
          const versionedFileName = `${dateString}_${version}${ext}`;
          versionedFilePath = path.join(directory, versionedFileName);
          version++;
        } while (await fs.pathExists(versionedFilePath));

        await fs.move(filePath, versionedFilePath);
        console.log(`✅ 重命名成功(添加版本号): ${file} -> ${path.basename(versionedFilePath)}`);
        results.push({success: true, file, newName: path.basename(versionedFilePath)});
      } else {
        await fs.move(filePath, newFilePath);
        console.log(`✅ 重命名成功: ${file} -> ${newFileName}`);
        results.push({success: true, file, newName: newFileName});
      }
    } catch (error) {
      console.error(`❌ 处理 ${file} 时出错: ${error.message}`);
      results.push({success: false, file, error: error.message});
    }
  }

  return results;
}

export { renameMedia, renameWxFile };