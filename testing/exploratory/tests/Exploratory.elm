module Exploratory exposing (..)

import Expect exposing (Expectation)
import Html
import Html.Attributes exposing (class)
import Test exposing (..)
import Test.Html.Query as Query
import Test.Html.Selector exposing (tag, text)


suite : Test
suite =
    describe "describe"
        [ test "one1234" <|
            \_ -> Expect.pass
        , todo "todasfsdasdffosdasdff12adsf23431221"

        -- , test "fail" <| \_ -> Expect.fail ""
        , describe "nested describe"
            [ test "ok" <| \_ -> Expect.pass
            ]
        , describe "deeply nested describe"
            [ describe "deeplest nested describe"
                [ test "ok" <| \_ -> Expect.pass
                ]
            ]
        , describe "duplicate describe"
            [ test "ok" <| \_ -> Expect.pass
            ]
        , describe "1duplicate describe"
            [ test "ok" <| \_ -> Expect.pass
            ]
        , describe "duplicate nested"
            [ test "ok" <| \_ -> Expect.pass
            , test "ok1" <| \_ -> Expect.pass
            ]
        ]


htmlSuite : Test
htmlSuite =
    describe "Html tests"
        [ test "Button has the expected text" <|
            \() ->
                Html.div [ class "container" ]
                    [ Html.button [] [ Html.text "I'm a button!" ] ]
                    |> Query.fromHtml
                    |> Query.find [ tag "button" ]
                    |> Query.has [ text "I'm a button!" ]
        , test "... fails" <|
            \() ->
                Html.div [ class "container" ]
                    [ Html.button [] [ Html.text "I'm a button!" ] ]
                    |> Query.fromHtml
                    |> Query.find [ tag "button1" ]
                    |> Query.has [ text "I'm a button!1" ]
        ]
