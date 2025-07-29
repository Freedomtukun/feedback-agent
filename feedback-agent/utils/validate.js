/**
 * utils/validate.js
 * --------------------------------------------------
 * 通用参数校验工具，纯原生实现，无第三方依赖。
 * @author
 * @version 1.0.0
 */

/**
 * 判断 value 的类型是否等于 expectedType
 * @param {*} value        - 要检查的值
 * @param {string} type    - 期望的类型字符串，支持：
 *                           string | number | boolean | object | array | function
 * @returns {boolean}
 */
function checkType(value, type) {
    const actual = Array.isArray(value) ? 'array' : typeof value;
    return actual === type.toLowerCase();
  }
  
  /**
   * 检查必填字段是否全部存在
   * @param {object} params        - 待检查的参数对象
   * @param {string[]} required    - 必填字段数组
   * @throws {Error}               - 缺失字段时抛错
   */
  function assertRequired(params = {}, required = []) {
    const missing = required.filter((k) => params[k] === undefined);
    if (missing.length) {
      throw new Error(`Missing required field(s): ${missing.join(', ')}`);
    }
  }
  
  /**
   * 快速 schema 校验（仅做类型&必填校验）
   * @param {object} data    - 待校验数据
   * @param {object} schema  - 形如 { fieldName: 'string', age: 'number', ... }
   */
  function validateSchema(data = {}, schema = {}) {
    Object.entries(schema).forEach(([field, type]) => {
      assertRequired(data, [field]);
      if (!checkType(data[field], type)) {
        throw new Error(`Field "${field}" should be ${type}`);
      }
    });
  }
  
  module.exports = {
    checkType,
    assertRequired,
    validateSchema
  };
  