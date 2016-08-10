$(function () {
  'use strict'

  var ACTION = {
    DIGIT: 0,
    PERIOD: 1,
    BINARY_OP: 2,
    EQUALS: 3
  }

  var OP = {
    PERCENTAGE: 0,
    DIVIDE: 1,
    MULTIPLY: 2,
    SUBTRACT: 3,
    ADD: 4
  }

  /**
   * Finite state machine
   * @param initState
   * @returns {{transition: transition}}
   * @constructor
   */
  function FSM (initState) {
    var currState = initState

    return {
      transition: function (action) {
        this.setState(currState(action))
      },

      setState: function (newState) {
        currState = newState
      }
    }
  }

  /**
   * Singleton controller for updating calculator view
   */
  var Calculator = (function () {
    const ZERO_TEXT = '0.'
    var $numElem = $('#number')
    var fsm = new FSM(startState)

    function startState (action) {
      switch (action.type) {
        case ACTION.DIGIT:
          $numElem.text(action.val)
          return integerState
        case ACTION.PERIOD:
          $numElem.text(ZERO_TEXT)
          return floatState
        case ACTION.BINARY_OP:
          return makeChainState($numElem.text(), action.val)
        default:
          return startState
      }
    }

    function integerState (action) {
      switch (action.type) {
        case ACTION.DIGIT:
          appendChar(action.val)
          return integerState
        case ACTION.PERIOD:
          appendChar(action.val)
          return floatState
        case ACTION.BINARY_OP:
          appendChar('.')
          return makeChainState($numElem.text(), action.val)
        default:
          return integerState
      }
    }

    function floatState (action) {
      switch (action.type) {
        case ACTION.DIGIT:
          appendChar(action.val)
          return floatState
        case ACTION.BINARY_OP:
          return makeChainState($numElem.text(), action.val)
        default:
          return floatState
      }
    }

    /**
     * Generator for Chain state transition fn, a modified Start state fn
     * @param lhsText LHS number string that will be used later
     * @param op
     * @returns {chainState}
     */
    function makeChainState (lhsText, op) {
      function wrapWithChainingActions (wrappedStateFn) {
        return function (action) {
          switch (action.type) {
            // Calculate and continue chaining
            case ACTION.BINARY_OP:
              $numElem.text(calculate(lhsText, op))
              appendPeriod()
              return makeChainState($numElem.text(), action.val)
            // Calculate and exit chaining
            case ACTION.EQUALS:
              $numElem.text(calculate(lhsText, op))
              appendPeriod()
              return startState
            // Otherwise, delegate to wrapped fn
            default:
              return wrappedStateFn(action)
          }
        }
      }

      return function chainState (action) {
        switch (action.type) {
          case ACTION.DIGIT:
            $numElem.text(action.val)
            return wrapWithChainingActions(integerState)
          case ACTION.PERIOD:
            $numElem.text(ZERO_TEXT)
            return wrapWithChainingActions(floatState)
          // Stay in chain state, update operation type
          case ACTION.BINARY_OP:
            appendPeriod()
            return makeChainState(lhsText, action.val)
          default:
            return chainState
        }
      }
    }

    function appendPeriod () {
      var currNum = $numElem.text()
      if (currNum.includes('.')) return
      $numElem.text(currNum + '.')
    }

    function appendChar (char) {
      var currNum = $numElem.text()
      $numElem.text(currNum + char)
    }

    function calculate (lhsText, op) {
      var lhs = parseFloat(lhsText)
      var rhs = parseFloat($numElem.text())

      switch (op) {
        case OP.PERCENTAGE:
          return lhs / 100. * rhs
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
    }

    return {
      clear: function () {
        $numElem.fadeOut(10, function () {
          $(this).text(ZERO_TEXT)
            .delay(100)
            .fadeIn(10)
        })
        fsm.setState(startState)
      },

      reverseSign: function () {
        var currNum = $numElem.text()

        if (currNum === ZERO_TEXT) return

        var newNum = currNum.startsWith('-')
          ? currNum.substr(1)
          : '-' + currNum
        $numElem.text(newNum)
      },

      update: function (action) {
        fsm.transition(action)
      }
    }
  })()

  $('.clear').on('click', Calculator.clear)
  $('.sign').on('click', Calculator.reverseSign)

  $('.digit').on('click', function () {
    Calculator.update({ type: ACTION.DIGIT, val: $(this).text() })
  })

  $('.period').on('click', function () {
    Calculator.update({ type: ACTION.PERIOD, val: '.' })
  })

  $('.binary_op').on('click', function () {
    Calculator.update({ type: ACTION.BINARY_OP, val: OP[ $(this).attr('data-optype') ] })
  })

  $('.equals').on('click', function () {
    Calculator.update({ type: ACTION.EQUALS })
  })
});