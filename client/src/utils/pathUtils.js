export const pathToURL = (path, params) => {
  const URL = Object.keys(params).reduce((result, param) => {
    return result.replace(`:${param}`, params[param]);
  }, path);

  return URL;
};
