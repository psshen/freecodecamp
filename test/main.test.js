/* eslint-env jasmine, jquery */

$.getScript('../src/main.js')

describe('Screen parse/display suite', function () {
  it('should load the screen fixture', function () {
    loadFixtures('screen-fixture.html')
  })

  var screen = new CalculatorApp.Screen()
  it('this should be true', function () {
    screen.printNumber(1)
    expect(screen.getNumber()).toBe(1)
  })
})