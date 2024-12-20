#!/usr/bin/env node
import { renameMedia,renameWxFile,resetAllFiles } from './index.js';
import path from 'path';
import minimist from 'minimist';

async function main() {
  const argv = minimist(process.argv.slice(2), {
    string: ['p'],
    boolean: ['e','m'],
    alias: {
      p: 'prefix',
      e: 'exif',
      m:'modify',
      r:'reset'
    },
    default: {
      p: '',
      e: false,
      m: false,
      r:false
    }
  });

  const targets = argv._;

  // 如果没有目标路径参数，显示帮助信息
  if (targets.length === 0) {
    showHelp();
    process.exit(1);
  }



  const target = targets[0];
  const absolutePath = path.resolve(process.cwd(), target);

  if (argv.m) {
    renameWxFile(absolutePath)
    return;
  }

  if (argv.r) {
    resetAllFiles(absolutePath)
    return;
  }

  try {
    await renameMedia(absolutePath, argv.prefix || '', argv.exif || false);
    console.log('执行完毕');
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
使用方法: rename [选项] <目标路径>

选项:
  -p, --prefix   指定文件名前缀,默认根据文件类型自动选择(IMG/VIDEO/AUDIO)
  -e, --exif     使用EXIF信息中的拍摄时间重命名(仅对图片有效)
  -m, --modify   重命名微信导出的文件(mmexport开头)
  -r, --reset    恢复所有文件到原始文件名

示例:
  rename .              重命名目录下所有支持的媒体文件
  rename . -p STR      自定义前缀
  rename . -e          使用EXIF信息重命名图片
  rename . -m         重命名微信导出的文件
  rename . -r         恢复所有文件到原始文件名
`);
}

main();