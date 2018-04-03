/* eslint-env jquery */
var CalculatorApp = (function () {
  'use strict'
  const MAX_DIGITS = 10 // Width of screen in digits

  var ACTION = {
    DIGIT: 0,
    PERIOD: 1,
    BINARY_OP: 2,
    EQUALS: 3,
    REVERSE_SIGN: 4
  }

  var OP = {
    PERCENTAGE: 0,
    DIVIDE: 1,
    MULTIPLY: 2,
    SUBTRACT: 3,
    ADD: 4
  }

  /**
   * Finite state machine that maintains a single state transition fn at a time that handles
   * transitions to the next state given some action.
   * @param initStateFn
   * @constructor
   */
  function FiniteStateMachine (initStateFn) {
    var currStateFn = initStateFn

    return {
      transition: function (action) {
        console.log('Transition from state: ' + currStateFn.name)
        this.setState(currStateFn(action))
      },

      setState: function (newStateFn) {
        currStateFn = newStateFn
      }
    }
  }

  /**
   * Displays, updates, and parses current number.
   */
  function Screen () {
    // Split up number into components since floats and scientific numbers aren't monospace
    let $integer = $('.integer')
    let $fraction = $('.fraction')
    let $exponent = $('.exponent')

    function zeroOut () {
      $fraction.text('')
      $exponent.text('')
      $integer.text('')
      $integer.fadeOut(0, function () {
        $(this).text('0')
          .toggleClass('decimal', true)
          .delay(100)
          .fadeIn(0)
      })
    }

    function printNumber (number) {
      changeToDecimal(number.isDecimal())
      let {integer, fraction, exponent} = number.toFormattedString()

      $integer.text(integer)
      $fraction.text(fraction)
      $exponent.text(exponent)
    }

    function changeToDecimal (bool) {
      $integer.toggleClass('decimal', bool)
    }

    return {
      zeroOut: zeroOut,
      printNumber: printNumber
    }
  }

  function ErrorNumber () {
    function isDecimal () {
      return false
    }

    function toFormattedString () {
      return {
        integer: 'Error',
        fraction: '',
        exponent: ''
      }
    }

    return {
      isDecimal: isDecimal,
      toFormattedString: toFormattedString
    }
  }

  const ERROR_NUMBER = ErrorNumber()

  function NumberWrapper (initNum, initIsDecimal) {
    let num = initNum
    let isDecimalNum = initIsDecimal

    function isDecimal () {
      return isDecimalNum
    }

    function toNumber () {
      return num
    }

    function truncateTrailingZeros (number) {
      let trailingZerosRegExp = /(.*?[^0]?)0+$/
      let match = trailingZerosRegExp.exec((number))
      if (match) {
        return match[1]
      } else {
        return number
      }
    }

    function toFormattedString () {
      let newInteger = ''
      let newFraction = ''
      let newExponent = ''

      // Number can't fit on screen, display in scientific notation
      let absNum = Math.abs(num)
      if (absNum >= 10 ** MAX_DIGITS || ((absNum < 10 ** -(MAX_DIGITS - 1)) && absNum > 0)) {
        let exponentialStr = num.toExponential()
        let exponentIndex = exponentialStr.indexOf('e')
        let mantissa = exponentialStr.substring(0, exponentIndex)
        let periodIndex = mantissa.indexOf('.')
        periodIndex = periodIndex === -1 ? mantissa.length : periodIndex
        let integer = mantissa.substring(0, periodIndex)
        let fraction = mantissa.substring(periodIndex + 1)
        let exponent = exponentialStr.substring(exponentIndex + 1)
        newInteger = integer
        newFraction = fraction.substring(0, MAX_DIGITS - 1)
        newExponent = exponent.substring(exponent.indexOf('+') === -1 ? 0 : 1)
      } else {
        let numberStr = num.toString()
        let decimalPointIndex = numberStr.indexOf('.')
        if (Number.isInteger(num)) {
          newInteger = numberStr
        } else {
          numberStr = num.toFixed(MAX_DIGITS)
          newInteger = numberStr.substring(0, decimalPointIndex)
          newFraction = numberStr.substring(decimalPointIndex + 1, Math.min(MAX_DIGITS + 1, numberStr.length))
          // Round last digit
          let digitAfterLast = numberStr.charAt(MAX_DIGITS + 1)
          if (digitAfterLast && digitAfterLast > 5) {
            newFraction = newFraction.slice(0, -1) + (parseInt(newFraction.charAt(newFraction.length - 1)) + 1)
          }
        }
      }

      newFraction = truncateTrailingZeros(newFraction)

      return {
        integer: newInteger,
        fraction: newFraction,
        exponent: newExponent
      }
    }

    return {
      isDecimal: isDecimal,
      toNumber: toNumber,
      toFormattedString: toFormattedString
    }
  }

  /**
   * Wraps a Number and provides methods for changing and formatting the number to conform to the calculator screen.
   * @param initNum
   * @param initIsDecimal
   * @constructor
   */
  function NumberBuilder (initNum, initIsDecimal) {
    const decimalNumberRe = /-?([0-9]+)((\.)([0-9]*))?/
    let match = decimalNumberRe.exec(initNum.toString())
    let integerStr = match[1]
    let fractionStr = ''
    if (match[4]) {
      fractionStr = match[4]
    }
    let isDecimalNum = initIsDecimal
    let isNegative = false

    function numDigits () {
      return integerStr.length + fractionStr.length
    }

    function appendDigit (digit) {
      if (numDigits() === MAX_DIGITS) {
        return false
      }

      if (isDecimalNum) {
        fractionStr += digit
      } else {
        integerStr += digit
      }

      return true
    }

    function reverseSign () {
      isNegative = !isNegative
    }

    function setDecimal (newIsDecimal) {
      isDecimalNum = newIsDecimal
    }

    function isDecimal () {
      return isDecimalNum
    }

    function toFormattedString () {
      return {
        integer: integerStr,
        fraction: fractionStr,
        exponent: ''
      }
    }

    function toNumber () {
      let numStr = (isNegative ? '-' : '') + integerStr + '.' + fractionStr
      return Number.parseFloat(numStr)
    }

    return {
      appendDigit: appendDigit,
      reverseSign: reverseSign,
      setDecimal: setDecimal,
      toNumber: toNumber,
      isDecimal: isDecimal,
      toFormattedString: toFormattedString
    }
  }

  /**
   * Controller for updating calculator view
   */
  function Calculator (screen) {
    let fsm = FiniteStateMachine(startStateGen(NumberBuilder(0, true)))

    function startStateGen (num) {
      return function startState (action) {
        switch (action.type) {
          case ACTION.DIGIT:
            num = NumberBuilder(parseInt(action.val), false)
            screen.printNumber(num)
            if (action.val === '0') {
              return zeroStateGen(num)
            } else {
              return integerStateGen(num)
            }
          case ACTION.PERIOD:
            num = NumberBuilder(0, true)
            screen.printNumber(num)
            return floatStateGen(num)
          case ACTION.BINARY_OP:
            screen.printNumber(num)
            return chainStateGen(num, action.val)
          case ACTION.REVERSE_SIGN:
            if (num.toNumber() === 0) {
              return startState
            }
            num.reverseSign()
            screen.printNumber(num)
            return startStateGen(num)
          default:
            return startState
        }
      }
    }

    function zeroStateGen (numBuilder) {
      return function zeroState (action) {
        switch (action.type) {
          case ACTION.DIGIT:
            numBuilder = NumberBuilder(parseInt(action.val), false)
            screen.printNumber(numBuilder)
            if (action.val === '0') {
              return zeroState
            } else {
              return integerStateGen(numBuilder)
            }
          case ACTION.PERIOD:
            numBuilder = NumberBuilder(0, true)
            screen.printNumber(numBuilder)
            return floatStateGen(numBuilder)
          case ACTION.BINARY_OP:
            screen.printNumber(numBuilder)
            return chainStateGen(numBuilder, action.val)
          case ACTION.REVERSE_SIGN:
            numBuilder.reverseSign()
            screen.printNumber(numBuilder)
            return zeroStateGen(numBuilder)
          default:
            return zeroState
        }
      }
    }

    /**
     * Number displayed on screen is an integer
     */
    function integerStateGen (numBuilder) {
      return function integerState (action) {
        switch (action.type) {
          case ACTION.DIGIT:
            numBuilder.appendDigit(action.val)
            screen.printNumber(numBuilder)
            return integerStateGen(numBuilder)
          case ACTION.PERIOD:
            numBuilder.setDecimal(true)
            screen.printNumber(numBuilder)
            return floatStateGen(numBuilder)
          case ACTION.BINARY_OP:
            numBuilder.setDecimal(true)
            screen.printNumber(numBuilder)
            return chainStateGen(numBuilder, action.val)
          case ACTION.REVERSE_SIGN:
            numBuilder.reverseSign()
            screen.printNumber(numBuilder)
            return integerStateGen(numBuilder)
          default:
            return integerState
        }
      }
    }

    /**
     * Number displayed on screen is floating point
     */
    function floatStateGen (numBuilder) {
      return function floatState (action) {
        switch (action.type) {
          case ACTION.DIGIT:
            numBuilder.appendDigit(action.val)
            screen.printNumber(numBuilder)
            return floatStateGen(numBuilder)
          case ACTION.BINARY_OP:
            screen.printNumber(numBuilder)
            return chainStateGen(numBuilder, action.val)
          case ACTION.REVERSE_SIGN:
            numBuilder.reverseSign()
            screen.printNumber(numBuilder)
            return floatStateGen(numBuilder)
          default:
            return floatState
        }
      }
    }

    function errorState (action) {
      return errorState
    }

    /**
     * Generator for the Chain state transition fn, a modified Start state fn in which the first
     * number in a chain has been entered.
     * @param lhsNum - Number passed into the chain that will be used as LHS value on next operation
     * @param op - Operation type
     * @returns {function} Chain state transition function
     */
    function chainStateGen (lhsNum, op) {
      function calculateAndContinue (lhsNum, rhsNum, action, defaultFn) {
        try {
          let result = calculate(lhsNum, rhsNum, op)
          console.log(result)
          let numberWrapper = NumberWrapper(result, true)
          screen.printNumber(numberWrapper)
          switch (action.type) {
            // Calculate and continue chain
            case ACTION.BINARY_OP:
              return chainStateGen(numberWrapper, action.val)
            // Calculate and exit chain
            case ACTION.EQUALS:
              return startStateGen(numberWrapper)
            default:
              return defaultFn
          }
        } catch (e) {
          if (e.message === 'Overflow') {
            screen.printNumber(ERROR_NUMBER)
            return errorState
          } else {
            throw e
          }
        }
      }

      /**
       * Number displayed on screen is an integer
       */
      function integerStateChainedGen (numBuilder) {
        return function integerStateChained (action) {
          switch (action.type) {
            case ACTION.DIGIT:
              numBuilder.appendDigit(action.val)
              screen.printNumber(numBuilder)
              return integerStateChainedGen(numBuilder)
            case ACTION.PERIOD:
              numBuilder.setDecimal(true)
              screen.printNumber(numBuilder)
              return floatStateChainedGen(numBuilder)
            case ACTION.REVERSE_SIGN:
              numBuilder.reverseSign()
              screen.printNumber(numBuilder)
              return integerStateChainedGen(numBuilder)
            default:
              return calculateAndContinue(lhsNum, numBuilder, action, integerStateChained)
          }
        }
      }

      /**
       * Number displayed on screen is floating point
       */
      function floatStateChainedGen (numBuilder) {
        return function floatStateChained (action) {
          switch (action.type) {
            case ACTION.DIGIT:
              numBuilder.appendDigit(action.val)
              screen.printNumber(numBuilder)
              return floatStateChainedGen(numBuilder)
            case ACTION.REVERSE_SIGN:
              numBuilder.reverseSign()
              screen.printNumber(numBuilder)
              return floatStateChainedGen(numBuilder)
            default:
              return calculateAndContinue(lhsNum, numBuilder, action, floatStateChained)
          }
        }
      }

      function zeroStateChainedGen (num) {
        return function zeroStateChained (action) {
          switch (action.type) {
            case ACTION.DIGIT:
              num = NumberBuilder(parseInt(action.val), false)
              screen.printNumber(num)
              if (action.val === '0') {
                return zeroStateChained
              } else {
                return integerStateChainedGen(num)
              }
            case ACTION.PERIOD:
              num = NumberBuilder(0, true)
              screen.printNumber(num)
              return floatStateChainedGen(num)
            case ACTION.BINARY_OP:
              screen.printNumber(num)
              return chainStateGen(num, action.val)
            case ACTION.REVERSE_SIGN:
              num.reverseSign()
              screen.printNumber(num)
              return zeroStateChainedGen(num)
            default:
              return calculateAndContinue(lhsNum, num, action, zeroStateChained)
          }
        }
      }

      function chainState (action) {
        let num
        switch (action.type) {
          case ACTION.DIGIT:
            num = NumberBuilder(parseInt(action.val), false)
            screen.printNumber(num)
            if (action.val === '0') {
              return zeroStateChainedGen(num)
            } else {
              return integerStateChainedGen(num)
            }
          case ACTION.PERIOD:
            num = NumberBuilder(0, true)
            screen.printNumber(num)
            return floatStateChainedGen(num)
          // Stay in chain state, update operation type
          case ACTION.BINARY_OP:
            screen.printNumber(lhsNum)
            return chainStateGen(lhsNum, action.val)
          case ACTION.EQUALS:
            screen.printNumber(lhsNum)
            return startStateGen(lhsNum)
          case ACTION.REVERSE_SIGN:
            lhsNum.reverseSign()
            screen.printNumber(lhsNum)
            return chainStateGen(lhsNum, op)
          default:
            return chainState
        }
      }

      return chainState
    }

    function calculate (lhs, rhs, op) {
      lhs = lhs.toNumber()
      rhs = rhs.toNumber()
      let result = (function () {
        switch (op) {
          case OP.PERCENTAGE:
            return lhs / 100 * rhs
          case OP.DIVIDE:
            return lhs / rhs
          case OP.MULTIPLY:
            return lhs * rhs
          case OP.SUBTRACT:
            return lhs - rhs
          case OP.ADD:
            return lhs + rhs
          default:
            return 0
        }
      })()

      if (result === Number.POSITIVE_INFINITY || result === Number.NEGATIVE_INFINITY) {
        throw Error('Overflow')
      }

      return result
    }

    return {
      clear: function () {
        fsm.setState(startStateGen(NumberBuilder(0, true)))
        screen.zeroOut()
      },
      update: function (action) {
        fsm.transition(action)
      }
    }
  }

  function bindFunctions (calc) {
    $('.clear').on('click', calc.clear)

    $('.sign').on('click', function () {
      calc.update({type: ACTION.REVERSE_SIGN})
    })

    $('.digit').on('click', function (e) {
      calc.update({type: ACTION.DIGIT, val: $(this).text()})
      e.stopPropagation()
    })

    $('.period').on('click', function () {
      calc.update({type: ACTION.PERIOD})
    })

    $('.binary_op').on('click', function () {
      calc.update({type: ACTION.BINARY_OP, val: OP[$(this).attr('data-optype')]})
    })

    $('.equals').on('click', function () {
      calc.update({type: ACTION.EQUALS})
    })

    $(document).on('keypress', function (event) {
      console.log('Pressed key: ' + event.key)
      switch (event.key) {
        case 'Delete':
        case 'c':
          calc.clear()
          break
        // case 'NumLock':
        //   calc.update(ACTION.REVERSE_SIGN)
        //   break
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          calc.update({type: ACTION.DIGIT, val: event.key})
          break
        case '.':
          calc.update({type: ACTION.PERIOD})
          break
        case '%':
          calc.update({type: ACTION.BINARY_OP, val: OP.PERCENTAGE})
          break
        case '/':
          calc.update({type: ACTION.BINARY_OP, val: OP.DIVIDE})
          break
        case '*':
          calc.update({type: ACTION.BINARY_OP, val: OP.MULTIPLY})
          break
        case '-':
          calc.update({type: ACTION.BINARY_OP, val: OP.SUBTRACT})
          break
        case '+':
          calc.update({type: ACTION.BINARY_OP, val: OP.ADD})
          break
        case 'Enter':
          calc.update({type: ACTION.EQUALS})
          // prevents trigger of a focused button's onclick listener
          event.preventDefault()
          break
      }
    })
  }

  function onReady () {
    var screen = Screen()
    var calc = Calculator(screen)
    bindFunctions(calc)
  }

  return {
    onReady: onReady
  }
})()

$(document).ready(CalculatorApp.onReady)
