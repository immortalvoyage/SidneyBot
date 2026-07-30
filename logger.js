function serialize(value) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }
  return value;
}

export function logInfo(message, data) {
  console.log(JSON.stringify({
    level: "INFO",
    time: new Date().toISOString(),
    message,
    data: serialize(data)
  }));
}

export function logWarn(message, data) {
  console.warn(JSON.stringify({
    level: "WARN",
    time: new Date().toISOString(),
    message,
    data: serialize(data)
  }));
}

export function logError(message, error) {
  console.error(JSON.stringify({
    level: "ERROR",
    time: new Date().toISOString(),
    message,
    error: serialize(error)
  }));
}
