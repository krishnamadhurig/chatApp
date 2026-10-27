const handle = (fn) => async (payload, ack) => {
  if (typeof payload === 'function') {
    ack = payload;
    payload = {};
  }
  const reply = typeof ack === 'function' ? ack : () => {};

  try {
    const data = await fn(payload || {});
    reply({ success: true, data });
  } catch (err) {
    if (!err.statusCode) console.error(err);
    reply({
      success: false,
      error: err.statusCode ? err.message : 'Something went wrong on the server',
    });
  }
};

module.exports = { handle };