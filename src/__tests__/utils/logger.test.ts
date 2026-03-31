import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger } from '../../utils/logger.js'

describe('logger', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('info()', () => {
    it('stderr に [INFO] プレフィックスで出力する', () => {
      logger.info('test message')
      expect(writeSpy).toHaveBeenCalledWith('[INFO] test message \n')
    })

    it('追加引数を JSON シリアライズして出力する', () => {
      logger.info('msg', { key: 'value' })
      expect(writeSpy).toHaveBeenCalledWith('[INFO] msg [{"key":"value"}]\n')
    })

    it('複数の追加引数を配列として出力する', () => {
      logger.info('msg', 1, 'two')
      expect(writeSpy).toHaveBeenCalledWith('[INFO] msg [1,"two"]\n')
    })
  })

  describe('warn()', () => {
    it('stderr に [WARN] プレフィックスで出力する', () => {
      logger.warn('warn message')
      expect(writeSpy).toHaveBeenCalledWith('[WARN] warn message \n')
    })

    it('追加引数を JSON シリアライズして出力する', () => {
      logger.warn('warn', { code: 42 })
      expect(writeSpy).toHaveBeenCalledWith('[WARN] warn [{"code":42}]\n')
    })
  })

  describe('error()', () => {
    it('stderr に [ERROR] プレフィックスで出力する', () => {
      logger.error('error message')
      expect(writeSpy).toHaveBeenCalledWith('[ERROR] error message \n')
    })

    it('追加引数を JSON シリアライズして出力する', () => {
      logger.error('oops', new Error('fail'))
      expect(writeSpy).toHaveBeenCalledTimes(1)
    })
  })
})
