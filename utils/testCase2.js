async function fetchProductPrice(productId) {
  const res = await fetch(`https://api.example.com/products/${productId}`);
  const data = await res.json();
  return data.price;
}

module.exports = { fetchProductPrice };