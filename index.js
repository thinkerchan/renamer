import fs from 'fs-extra';
import path from 'path';
import glob from 'fast-glob';

const supportedExtensions = {
  IMG: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'tiff', 'tif', 'bmp', 'raw', 'arw', 'cr2', 'nef'],
  VIDEO: ['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', '3gp', 'webm'],
  AUDIO: ['mp3', 'wav', 'aac', 'ogg', 'm4a', 'wma']
};

// 缓存扁平化的扩展名列表
const flattenedExtensions = Object.values(supportedExtensions).flat();

async function extractExifDate(filePath) {
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
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

async function renameMedia(targetPath) {
  const stats = await fs.stat(targetPath);

  if (stats.isFile()) {
    const { ext } = await extractExifDate(targetPath);
    if (isMediaFile(ext)) {
      await renameSingleFile(targetPath);
    } else {
      console.warn(`跳过非媒体文件: ${targetPath}`);
    }
  } else if (stats.isDirectory()) {
    await renameDirectory(targetPath);
  } else {
    throw new Error(`无效的路径: ${targetPath}`);
  }
}

async function renameSingleFile(filePath) {
  const dir = path.dirname(filePath);

  try {
    const { time, ext } = await extractExifDate(filePath);
    const dateString = formatDateTime(time);

    const prefix = Object.keys(supportedExtensions).find(key =>
      supportedExtensions[key].includes(ext.slice(1).toLowerCase())
    );

    if (!prefix) {
      throw new Error(`不支持的文件类型: ${ext}`);
    }

    const newFileName = `${prefix}_${dateString}${ext.toLowerCase()}`;
    const newFilePath = path.join(dir, newFileName);

    if (await fs.pathExists(newFilePath)) {
      throw new Error(`目标文件已存在: ${newFileName}`);
    }

    if (filePath !== newFilePath) {
      await fs.move(filePath, newFilePath);
      console.log(`✅ 重命名成功: ${path.basename(filePath)} -> ${newFileName}`);
    } else {
      console.log(`⏭️ 跳过: 文件名相同`);
    }
  } catch (error) {
    console.error(`❌ 处理 ${filePath} 时出错: ${error.message}`);
  }
}

async function renameDirectory(directory) {
  const files = await glob(`*.{${flattenedExtensions.join(',')}}`, {
    cwd: directory,
    caseSensitiveMatch: false,
    absolute: true
  });

  await Promise.all(files.map(file => renameSingleFile(file)));
}

function isMediaFile(ext) {
  return flattenedExtensions.includes(ext.slice(1).toLowerCase());
}

export { renameMedia };