import fs from 'fs-extra';
import path from 'path';
import glob from 'fast-glob';
import ExifReader from 'exif-reader';

async function extractExifDate(filePath) {
  try {
    // 对于视频文件,直接使用文件创建时间,避免读取大文件
    if (isVideoFile(path.extname(filePath))) {
      const stats = await fs.stat(filePath);
      return stats.birthtime;
    }

    const buffer = await fs.readFile(filePath);

    // 读取 EXIF 数据
    const exif = ExifReader(buffer);

    if (exif && exif.exif && exif.exif.DateTimeOriginal) {
      // 如果存在 EXIF 创建时间，返回日期对象
      return new Date(exif.exif.DateTimeOriginal * 1000);
    }

    // 如果没有 EXIF 数据，返回文件创建时间
    const stats = await fs.stat(filePath);
    return stats.birthtime;
  } catch (error) {
    // 如果读取失败，返回文件创建时间
    const stats = await fs.stat(filePath);
    return stats.birthtime;
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
    // 处理单个文件
    const ext = path.extname(targetPath);
    if (isMediaFile(ext)) {
      await renameSingleFile(targetPath);
    } else {
      console.warn(`跳过非媒体文件: ${targetPath}`);
    }
  } else if (stats.isDirectory()) {
    // 处理目录
    await renameDirectory(targetPath);
  } else {
    throw new Error(`无效的路径: ${targetPath}`);
  }
}

async function renameSingleFile(filePath) {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);

  try {
    const date = await extractExifDate(filePath);
    const dateString = formatDateTime(date);

    // 生成新文件名
    const newFileName = `IMG_${dateString}${ext.toLowerCase()}`;
    const newFilePath = path.join(dir, newFileName);

    // 如果新文件名与原文件名不同，则重命名
    if (filePath !== newFilePath) {
      await fs.move(filePath, newFilePath, { overwrite: false });
      console.log(`重命名: ${path.basename(filePath)} -> ${newFileName}`);
    }
  } catch (error) {
    console.error(`处理 ${filePath} 时出错: ${error.message}`);
  }
}

async function renameDirectory(directory) {
  // 支持的文件类型
  const supportedExtensions = [
     // 图片格式
     'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'tiff', 'tif', 'bmp', 'raw', 'arw', 'cr2', 'nef',
     // 视频格式
     'mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', '3gp', 'webm',
     // 音频格式
     'mp3', 'wav', 'aac', 'ogg', 'm4a', 'wma'
  ];

  // 只查找当前目录下的媒体文件（不包含子目录）
  const files = await glob(`*.{${supportedExtensions.join(',')}}`, {
    cwd: directory,
    caseSensitiveMatch: false,
    absolute: true
  });

  for (const file of files) {
    await renameSingleFile(file);
  }
}

function isMediaFile(ext) {
  const supportedExtensions = [
    '.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mov', '.avi'
  ];
  return supportedExtensions.includes(ext.toLowerCase());
}

function isVideoFile(ext) {
  const videoExtensions = [
    '.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.3gp', '.webm'
  ];
  return videoExtensions.includes(ext.toLowerCase());
}

export { renameMedia };