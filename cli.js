#!/usr/bin/env node
import { renameMedia } from './index.js';
import path from 'path';

async function main() {
  const args = process.argv.slice(2);

  // 如果没有参数，显示帮助信息
  if (args.length === 0) {
    showHelp();
    process.exit(1);
  }

  const target = args[0];
  const absolutePath = path.resolve(process.cwd(), target);

  try {
    await renameMedia(absolutePath);
    console.log('执行完毕');
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
}

function showHelp() {
  console.log('使用方法: rename <目标路径>');
  console.log('示例:');
  console.log('  rename .             # 重命名当前目录下的所有媒体文件');
  console.log('  rename photos        # 重命名 photos 目录下的所有媒体文件');
  console.log('  rename image.jpg     # 重命名单个文件');
}

main();