const buildOptions = (data) => {
  const options = {};

  if (data) {
    (options.headers = {
      "Content-Type": "application/json",
    }),
      (options.body = JSON.stringify(data));
  }

  const accessToken = localStorage.getItem("accessToken");

  if (accessToken) {
    options.headers = {
      ...options.headers,
      "X-Authorization": accessToken,
    };
  }

  return options;
};

const request = async (method, url, data) => {
  const response = await fetch(url, {
    method,
    ...buildOptions(data),
  });

  if (response.status === 204) {
    return {};
  }

  const result = await response.json();

  if (!response.ok) {
    throw result;
  }

  return result;
};

export const get = request.bind(null, "GET");
export const post = request.bind(null, "POST");
export const put = request.bind(null, "PUT");
export const patch = request.bind(null, "PATCH");
export const del = request.bind(null, "DELETE");
