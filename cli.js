#!/usr/bin/env node
import { renameMedia,renameWxFile } from './index.js';
import path from 'path';
import minimist from 'minimist';

async function main() {
  const argv = minimist(process.argv.slice(2), {
    string: ['p'],
    boolean: ['e','m'],
    alias: {
      p: 'prefix',
      e: 'exif',
      m:'modify'
    },
    default: {
      p: '',
      e: false,
      m: false,
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

  try {
    await renameMedia(absolutePath, argv.prefix || '', argv.exif || false);
    console.log('执行完毕');
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
}

function showHelp() {
  console.log('使用方法: rename [选项] <目标路径>');
  console.log('选项:');
  console.log('  -p, --prefix <前缀>  设置文件名前缀');
  console.log('示例:');
  console.log('  rename .                     # 重命名当前目录下的所有媒体文件');
  console.log('  rename -p IMG photos         # 重命名 photos 目录下的所有媒体文件，添加前缀 IMG');
  console.log('  rename --prefix TEST image.jpg  # 重命名单个文件，添加前缀 TEST');
}

main();